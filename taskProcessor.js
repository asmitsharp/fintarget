const fs = require("fs/promises")

// Function to simulate task processing and log completion
async function task(user_id) {
  const logMessage = `${user_id} - Task completed at - ${new Date().toISOString()}\n`
  await fs.appendFile("task_log.txt", logMessage)
  console.log(logMessage.trim())
}

// Process the task for the user
async function processTask(user_id, redis) {
  const queueKey = `taskQueue:${user_id}`
  const processedKey = `processedCount:${user_id}`

  // Add task to the Redis queue
  await redis.rpush(queueKey, Date.now().toString())

  // Start processing in the background
  setImmediate(() => processQueue(user_id, redis, queueKey, processedKey))
}

// Queue processing function for the user
async function processQueue(user_id, redis, queueKey, processedKey) {
  while (true) {
    const lastTaskTime = await redis.get(`lastTaskTime:${user_id}`)
    const now = Date.now()

    if (!lastTaskTime || now - parseInt(lastTaskTime) >= 1000) {
      // Get the next task from the queue
      const nextTask = await redis.lpop(queueKey)

      if (nextTask) {
        // Process the task
        await task(user_id)

        // Update the last processed task time
        await redis.set(`lastTaskTime:${user_id}`, now.toString())

        // Increment the processed task count
        await redis.incr(processedKey)
      } else {
        break // No more tasks, break the loop
      }
    } else {
      // Wait for the remaining time before the next task can be processed
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 - (now - parseInt(lastTaskTime)))
      )
    }
  }

  // Remove the processing lock
  await redis.del(`processing:${user_id}`)
}

// Get task stats for a user (tasks in queue, tasks processed)
async function getTaskStats(user_id, redis) {
  const queueKey = `taskQueue:${user_id}`
  const processedKey = `processedCount:${user_id}`

  // Get tasks remaining in the queue and processed count
  const [tasksInQueue, tasksProcessed] = await Promise.all([
    redis.llen(queueKey), // Count tasks in queue
    redis.get(processedKey), // Get the number of processed tasks
  ])

  return {
    user_id,
    tasksInQueue: tasksInQueue || 0,
    tasksProcessed: parseInt(tasksProcessed || "0", 10),
  }
}

module.exports = { processTask, getTaskStats }
