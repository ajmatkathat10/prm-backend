# Project & Resource Management (PRM) Tool — Backend

This is the Express + Node.js API server for the Project & Resource Management (PRM) Tool, built using TypeScript and MongoDB (Mongoose). It implements secure session cookies and follows strict SOLID design principles.

---

## 🚀 Tech Stack

*   **Runtime Environment**: Node.js (v18+)
*   **Web Framework**: Express.js
*   **Language**: TypeScript
*   **Database**: MongoDB + Mongoose (ODM)
*   **Authentication & Hashing**: JSON Web Tokens (JWT) + Bcrypt

---

## 📂 Project Structure

The codebase is organized into layers to isolate database queries, business logic, and HTTP concerns:

```
prm-backend/
├── src/
│   ├── config/          # Database connection, env configuration (Singleton env.ts)
│   ├── constants/       # Centralized HTTP status and messages catalog
│   ├── middleware/      # Express middleware functions (JWT Auth checks)
│   ├── models/          # Mongoose database models & typescript schemas
│   ├── repositories/    # Base & concrete database repository classes (Repository pattern)
│   ├── routes/          # Express route handler files (Thin Controllers)
│   ├── services/        # Service class business logic modules
│   ├── seed.ts          # Database seed script for initializing mock mock collections
│   └── server.ts        # Server bootstrap logic
├── .env                 # Environment variables file (ignored in Git)
└── package.json         # Build and execution script keys
```

---

## 🛠️ Setup & Local Development

### 1. Pre-requisites
Ensure you have **Node.js** and an active **MongoDB** instance (local instance or MongoDB Atlas cluster URI).

### 2. Configure Environment Variables
Create a `.env` file in the backend root directory:
```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
COOKIE_NAME=prm_session
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed Database
Seeding drops the active collections and inserts fresh initial admin, manager, employee, projects, and skills records:
```bash
npm run seed
```

### 5. Start Development Server
```bash
npm run dev
```
The server will boot on **`http://localhost:5001`**.

---

## 📚 Development Standards & Guidelines

*   **Layer Stack**: Never skip a layer! All endpoints should flow as follows: `Route (Controller) -> Service -> Repository -> Model`.
*   **Singletons**: Read environment variables only from `config/env.ts`. Never read `process.env` directly in code.
*   **Centralized Constants**: Place all messages, error codes, and configuration defaults under `src/constants/` to keep string logs centralized and maintainable.
