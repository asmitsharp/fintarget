const express = require("express")
const cluster = require("cluster")
const Redis = require("ioredis")
const rateLimit = require("./rateLimit")
const { processTask, getTaskStats } = require("./taskProcessor")

const app = express()
app.use(express.json())

const redis = new Redis()

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ message: "Server is running." })
})

// Endpoint to check the number of tasks in queue and processed for a user
app.get("/task/stats/:user_id", async (req, res) => {
  const { user_id } = req.params

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required." })
  }

  try {
    // Fetch the task stats for a user
    const stats = await getTaskStats(user_id, redis)
    res.status(200).json(stats)
  } catch (error) {
    console.error("Error fetching task stats:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Task queue endpoint
app.post("/task", rateLimit, async (req, res) => {
  const { user_id } = req.body

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required." })
  }

  try {
    // Queue the task for processing
    await processTask(user_id, redis)
    res.status(202).json({ message: "Task queued successfully." })
  } catch (error) {
    console.error("Error processing task:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Server cluster setup to take advantage of multi-core systems
const PORT = 3000
if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`)

  // Fork workers (create 2 worker processes)
  for (let i = 0; i < 2; i++) {
    cluster.fork()
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died, respawning...`)
    cluster.fork()
  })
} else {
  // Worker processes
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} started and listening on port ${PORT}`)
  })
}
