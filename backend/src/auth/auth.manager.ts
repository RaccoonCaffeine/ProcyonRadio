import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dbService } from "../database/database.service.js";

export type UserRole = "owner" | "admin" | "operator";

export interface User {
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
}

export interface Session {
  token: string;
  username: string;
  role: UserRole;
  expiresAt: number;
}

const SESSIONS_FILE_PATH = path.join(process.cwd(), "data", "sessions.json");
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

class AuthManager {
  private users: User[] = [];
  private sessions: Map<string, Session> = new Map();

  constructor() {
    this.load();
    this.loadSessions();
  }

  /** Loads users from SQLite users table, with fallback to legacy users.json (local or parent). */
  load(): void {
    const db = dbService.getDb();

    try {
      // Fetch users joining with roles table
      const rows = db
        .prepare(
          `
        SELECT u.username, u.password_hash, u.created_at, r.role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id
      `,
        )
        .all() as {
        username: string;
        password_hash: string;
        created_at: string;
        role_name: string;
      }[];

      if (rows.length > 0) {
        this.users = rows.map((row) => {
          // password_hash is stored as "salt.hash"
          const parts = row.password_hash.split(".");
          const salt = parts[0] || "";
          const passwordHash = parts[1] || "";
          return {
            username: row.username,
            passwordHash,
            salt,
            role: row.role_name as UserRole,
            createdAt: row.created_at,
          };
        });
        return;
      }
    } catch (err) {
      console.error("⚠️ Error reading users from database:", err);
    }

    // If DB is empty, check if we have a legacy users.json
    let legacyPath = path.join(process.cwd(), "data", "users.json");
    if (!fs.existsSync(legacyPath)) {
      legacyPath = path.join(process.cwd(), "..", "data", "users.json");
    }

    if (fs.existsSync(legacyPath)) {
      try {
        console.log(
          `📝 Migrating legacy users.json (${legacyPath}) to SQLite...`,
        );
        const fileContent = fs.readFileSync(legacyPath, "utf-8");
        const parsedUsers = JSON.parse(fileContent) as User[];
        for (const u of parsedUsers) {
          this.insertUserToDb(u);
        }
        this.users = parsedUsers;
        this.cleanupLegacyJson(legacyPath);
        return;
      } catch (err) {
        console.error("⚠️ Failed to migrate legacy users.json:", err);
      }
    }

    this.users = [];
  }

  /** Helper to insert a user record into SQLite users table. */
  private insertUserToDb(user: User): void {
    try {
      const db = dbService.getDb();
      const roleRow = db
        .prepare("SELECT id FROM roles WHERE role_name = ?")
        .get(user.role) as { id: number } | undefined;
      const roleId = roleRow ? roleRow.id : null;
      const combinedHash = `${user.salt}.${user.passwordHash}`;

      db.prepare(
        `
        INSERT OR REPLACE INTO users (username, display_name, password_hash, role_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(user.username, user.username, combinedHash, roleId, user.createdAt);
      console.log(`💾 User '${user.username}' saved to SQLite.`);
    } catch (err) {
      console.error(
        `❌ Failed to save user '${user.username}' to SQLite:`,
        err,
      );
    }
  }

  /** Loads sessions from sessions.json. */
  private loadSessions(): void {
    if (fs.existsSync(SESSIONS_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(SESSIONS_FILE_PATH, "utf-8");
        const sessionList = JSON.parse(fileContent) as [string, Session][];
        this.sessions = new Map(sessionList);

        // Clean expired sessions on load
        const now = Date.now();
        let expiredFound = false;
        for (const [token, session] of this.sessions.entries()) {
          if (now > session.expiresAt) {
            this.sessions.delete(token);
            expiredFound = true;
          }
        }
        if (expiredFound) {
          this.saveSessions();
        }
      } catch (err) {
        console.error(
          "⚠️ Error reading sessions.json, initialized empty sessions:",
          err,
        );
        this.sessions = new Map();
      }
    }
  }

  /** Saves sessions to sessions.json. */
  private saveSessions(): void {
    try {
      const sessionList = Array.from(this.sessions.entries());
      fs.writeFileSync(
        SESSIONS_FILE_PATH,
        JSON.stringify(sessionList, null, 2),
        "utf-8",
      );
    } catch (err) {
      console.error("❌ Failed to write sessions.json:", err);
    }
  }

  /** Checks if the owner account has been registered. */
  isSetupComplete(): boolean {
    return this.users.some((u) => u.role === "owner");
  }

  /** Registers the initial owner account. Only works if setup is incomplete. */
  registerOwner(username: string, password: string): User {
    if (this.isSetupComplete()) {
      throw new Error("Setup has already been completed.");
    }
    if (!username || username.trim().length < 3) {
      throw new Error("Username must be at least 3 characters.");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }

    // Clean other users if setup is somehow being reset
    this.users = this.users.filter((u) => u.role !== "owner");

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = this.hashPassword(password, salt);

    const owner: User = {
      username: username.trim().toLowerCase(),
      passwordHash,
      salt,
      role: "owner",
      createdAt: new Date().toISOString(),
    };

    this.users.push(owner);
    this.insertUserToDb(owner);
    console.log(
      `👑 Owner account '${owner.username}' successfully registered.`,
    );
    return owner;
  }

  /** Creates a new user. Enforces RBAC creation rules. */
  createUser(
    creatorRole: UserRole,
    username: string,
    password: string,
    role: UserRole,
  ): User {
    if (!username || username.trim().length < 3) {
      throw new Error("Username must be at least 3 characters.");
    }
    const cleanUsername = username.trim().toLowerCase();

    // Check if user already exists
    if (this.users.some((u) => u.username === cleanUsername)) {
      throw new Error("User already exists.");
    }

    // Role creation hierarchy:
    // - Owner can create: admin, operator
    // - Admin can create: operator only
    // - Operator cannot create anyone
    if (role === "owner") {
      throw new Error("Cannot create additional Owner accounts.");
    }

    if (creatorRole === "operator") {
      throw new Error("Operators cannot create users.");
    }

    if (creatorRole === "admin" && role === "admin") {
      throw new Error("Administrators cannot create other Administrators.");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = this.hashPassword(password, salt);

    const user: User = {
      username: cleanUsername,
      passwordHash,
      salt,
      role,
      createdAt: new Date().toISOString(),
    };

    this.users.push(user);
    this.insertUserToDb(user);
    return user;
  }

  /** Deletes a user. Enforces RBAC deletion hierarchy. */
  deleteUser(
    creatorRole: UserRole,
    creatorUsername: string,
    targetUsername: string,
  ): void {
    const cleanTarget = targetUsername.trim().toLowerCase();
    const target = this.users.find((u) => u.username === cleanTarget);

    if (!target) {
      throw new Error("User not found.");
    }

    if (target.role === "owner") {
      throw new Error("The Owner account cannot be deleted.");
    }

    if (creatorUsername === cleanTarget) {
      throw new Error("You cannot delete your own account.");
    }

    // Deletion Hierarchy:
    // - Owner can delete: admin, operator
    // - Admin can delete: operator only
    // - Operator cannot delete anyone
    if (creatorRole === "operator") {
      throw new Error("Operators cannot delete users.");
    }

    if (creatorRole === "admin" && target.role === "admin") {
      throw new Error("Administrators cannot delete other Administrators.");
    }

    this.users = this.users.filter((u) => u.username !== cleanTarget);

    // Delete from DB
    try {
      const db = dbService.getDb();
      db.prepare("DELETE FROM users WHERE username = ?").run(cleanTarget);
      console.log(`🧹 Deleted user '${cleanTarget}' from SQLite.`);
    } catch (err) {
      console.error(
        `❌ Failed to delete user '${cleanTarget}' from SQLite:`,
        err,
      );
    }

    // Invalidate sessions for deleted user
    let sessionsChanged = false;
    for (const [token, session] of this.sessions.entries()) {
      if (session.username === cleanTarget) {
        this.sessions.delete(token);
        sessionsChanged = true;
      }
    }
    if (sessionsChanged) {
      this.saveSessions();
    }
  }

  /** Lists all users (excluding sensitive hash info). Accessible by Admin/Owner. */
  listUsers(): Omit<User, "passwordHash" | "salt">[] {
    return this.users.map(({ username, role, createdAt }) => ({
      username,
      role,
      createdAt,
    }));
  }

  /** Authenticates user and returns a new session token. */
  login(username: string, password: string): Session {
    const cleanUsername = username.trim().toLowerCase();
    const user = this.users.find((u) => u.username === cleanUsername);

    if (!user) {
      throw new Error("Invalid username or password.");
    }

    const hash = this.hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      throw new Error("Invalid username or password.");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const session: Session = {
      token,
      username: user.username,
      role: user.role,
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
    };

    this.sessions.set(token, session);
    this.saveSessions();
    return session;
  }

  /** Invalidates a session token. */
  logout(token: string): void {
    this.sessions.delete(token);
    this.saveSessions();
  }

  /** Resolves session token and returns active session details. Cleans up expired sessions. */
  getSession(token: string): Session | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }

    return session;
  }

  private hashPassword(password: string, salt: string): string {
    return crypto
      .pbkdf2Sync(password, salt, 1000, 64, "sha512")
      .toString("hex");
  }

  private cleanupLegacyJson(filePath?: string): void {
    try {
      const pathsToClean = filePath
        ? [filePath]
        : [
            path.join(process.cwd(), "data", "users.json"),
            path.join(process.cwd(), "..", "data", "users.json"),
          ];
      for (const p of pathsToClean) {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.log(`🧹 Legacy users.json removed: ${p}`);
        }
      }
    } catch (err) {
      console.warn("⚠️ Failed to remove legacy users.json:", err);
    }
  }
}

export const authManager = new AuthManager();
