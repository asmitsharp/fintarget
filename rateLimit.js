const Redis = require("ioredis")
const redis = new Redis()

// Rate limit configurations
const RATE_LIMIT_SECOND = 1 // Limit requests to 1 per second
const RATE_LIMIT_MINUTE = 20 // Limit requests to 20 per minute

// Rate-limiting middleware
async function rateLimit(req, res, next) {
  const { user_id } = req.body
  const now = Date.now()
  const secondKey = `rateLimit:${user_id}:second`
  const minuteKey = `rateLimit:${user_id}:minute`

  // Check the number of requests in the last second and minute
  const [secondCount, minuteCount] = await Promise.all([
    redis.zcount(secondKey, now - 1000, now),
    redis.zcount(minuteKey, now - 60000, now),
  ])

  // If the user has exceeded the limit, return a 429 response
  if (secondCount >= RATE_LIMIT_SECOND || minuteCount >= RATE_LIMIT_MINUTE) {
    res.status(429).json({ error: "Rate limit exceeded. Task will be queued." })
    return
  }

  // Add the current request to the Redis sorted set for tracking
  await Promise.all([
    redis.zadd(secondKey, now, now.toString()),
    redis.zadd(minuteKey, now, now.toString()),
    redis.expire(secondKey, 2), // Expire the second key after 2 seconds
    redis.expire(minuteKey, 61), // Expire the minute key after 61 seconds
  ])

  next() // Proceed to the next middleware if rate limit is not exceeded
}

module.exports = rateLimit
