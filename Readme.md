# FinTarget

FinTarget Assignment for creating a Node.js API that implements a task queuing system with rate limiting. It uses Redis for queue management and rate limiting.

## Prerequisites

- Node.js (version 14 or higher recommended)
- npm
- Redis server

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/asmitsharp/fintarget.git
   cd fintarget
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Ensure you have a Redis server running locally on the default port (6379).

## Running the Server

Start the server using:

```
npm start
```

This will start the server on port 3000.

## API Usage

Here are some curl commands to interact with the API:

1. Health Check:

   ```
   curl http://localhost:3000/
   ```

2. Queue a Task:

   ```
   curl -X POST -H "Content-Type: application/json" -d '{"user_id":"123"}' http://localhost:3000/task
   ```

3. Get Task Stats:
   ```
   curl http://localhost:3000/task/stats/123
   ```

## Rate Limiting

The `/task` endpoint is rate-limited to 1 request per second and 20 requests per minute per user. If you exceed this limit, you'll receive a 429 status code.

## Running Tests

To run the test suite:

```
npm test
```

## Project Structure

- `server.js`: Main application file
- `rateLimit.js`: Rate limiting middleware
- `taskProcessor.js`: Task processing logic
- `__test__/taskSystem.test.js`: Test suite

## Dependencies

- express: Web server framework
- ioredis: Redis client for Node.js
- jest: Testing framework
- supertest: HTTP assertions for testing
- ioredis-mock: Mock Redis client for testing
