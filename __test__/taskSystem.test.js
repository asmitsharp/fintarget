const Redis = require("ioredis-mock")
const rateLimit = require("../rateLimit")
const { processTask, getTaskStats } = require("../taskProcessor")

jest.mock("ioredis", () => require("ioredis-mock"))
jest.mock("fs/promises", () => ({
  appendFile: jest.fn().mockResolvedValue(undefined),
}))

describe("Task System Tests", () => {
  let redis
  let mockReq
  let mockRes
  let mockNext

  beforeEach(() => {
    redis = new Redis()
    mockReq = { body: { user_id: "123" } }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    mockNext = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
    redis.flushall()
  })

  describe("Rate Limiting", () => {
    it("should allow requests within rate limit", async () => {
      await rateLimit(mockReq, mockRes, mockNext)
      expect(mockNext).toHaveBeenCalled()
    })

    it("should block requests exceeding rate limit", async () => {
      for (let i = 0; i < 21; i++) {
        await rateLimit(mockReq, mockRes, mockNext)
      }
      expect(mockRes.status).toHaveBeenCalledWith(429)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Rate limit exceeded"),
        })
      )
    })
  })

  describe("Task Processing", () => {
    it("should queue a task successfully", async () => {
      await processTask("123", redis)
      const queueLength = await redis.llen("taskQueue:123")
      expect(queueLength).toBe(1)
    })

    it("should process queued tasks", async () => {
      await processTask("123", redis)
      await processTask("123", redis)

      // Wait for tasks to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const stats = await getTaskStats("123", redis)
      expect(stats.tasksProcessed).toBe(2)
      expect(stats.tasksInQueue).toBe(0)
    })
  })

  describe("Task Stats", () => {
    it("should return correct stats for a user", async () => {
      await processTask("123", redis)
      await processTask("123", redis)

      // Wait for tasks to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const stats = await getTaskStats("123", redis)
      expect(stats).toEqual({
        user_id: "123",
        tasksProcessed: 2,
        tasksInQueue: 0,
      })
    })

    it("should return zero stats for a new user", async () => {
      const stats = await getTaskStats("456", redis)
      expect(stats).toEqual({
        user_id: "456",
        tasksProcessed: 0,
        tasksInQueue: 0,
      })
    })
  })

  describe("Edge Cases", () => {
    let redis

    beforeEach(() => {
      redis = new Redis()
      mockReq = { body: { user_id: "testUser" } }
      mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() }
      mockNext = jest.fn()
    })

    afterEach(() => {
      jest.clearAllMocks()
      redis.flushall()
    })

    it("should handle concurrent requests correctly", async () => {
      const promises = []
      for (let i = 0; i < 30; i++) {
        promises.push(processTask("123", redis))
      }
      await Promise.all(promises)

      // Wait for tasks to be processed
      await new Promise((resolve) => setTimeout(resolve, 10000))

      const stats = await getTaskStats("123", redis)
      expect(stats.tasksProcessed + stats.tasksInQueue).toBe(30)
    }, 15000)

    it("should handle rate limiting across multiple users", async () => {
      const startTime = 1609459200000 // 2021-01-01 00:00:00 UTC
      let currentTime = startTime

      // Mock Date.now() to return controlled time
      jest.spyOn(Date, "now").mockImplementation(() => currentTime)

      const user1Req = { body: { user_id: "126" } }
      const user2Req = { body: { user_id: "127" } }

      let totalCalls = 0

      for (let i = 0; i < 20; i++) {
        await rateLimit(user1Req, mockRes, mockNext)
        totalCalls++
        console.log(`User 1 pass ${i + 1}`)

        currentTime += 1000 // Advance time by 1 second
        Date.now.mockImplementation(() => currentTime)

        await rateLimit(user2Req, mockRes, mockNext)
        totalCalls++
        console.log(`User 2 pass ${i + 1}`)

        currentTime += 1000 // Advance time by 1 second
        Date.now.mockImplementation(() => currentTime)
      }

      console.log(`Total calls: ${totalCalls}`)
      expect(totalCalls).toBe(40)

      // Test rate limiting
      await rateLimit(user1Req, mockRes, mockNext)
      expect(mockRes.status).toHaveBeenCalledWith(429)

      currentTime += 1000 // Advance time by 1 second
      Date.now.mockImplementation(() => currentTime)

      await rateLimit(user2Req, mockRes, mockNext)
      totalCalls++
      expect(totalCalls).toBe(41)
    })

    afterAll(() => {
      jest.restoreAllMocks()
    })
  })
})
