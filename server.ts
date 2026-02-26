import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("bossexam.db");

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "bossexam-jwt-secret-v2";
const JWT_EXPIRES = "30d";

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// In-memory stores (no cookie/session): капча и лимит просмотров
const captchaStore = new Map<string, string>();
const viewLimitStore = new Map<string, number>();

function userFromToken(req: any): any {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.userId) as any;
    if (!user || user.is_blocked === 1) return null;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
      avatar: user.avatar,
      telegram: user.telegram,
      is_verified: user.is_verified === 1,
      is_blocked: user.is_blocked === 1,
      block_reason: user.block_reason,
      balance: user.balance,
      created_at: user.created_at || null,
    };
  } catch {
    return null;
  }
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'Общее',
    author TEXT DEFAULT 'Администратор',
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'superadmin', 'admin', 'user'
    display_name TEXT,
    avatar TEXT,
    telegram TEXT,
    is_verified INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    block_reason TEXT,
    balance INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migration: Add missing columns if they don't exist
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    console.log(`Added column ${column} to ${table}`);
  } catch (e: any) {
    if (!e.message.includes("duplicate column name")) {
      // Ignore if column already exists, otherwise log
      // console.error(`Error adding column ${column}:`, e.message);
    }
  }
};

addColumn('articles', 'author', "TEXT DEFAULT 'Администратор'");
addColumn('articles', 'views', "INTEGER DEFAULT 0");
addColumn('users', 'role', "TEXT DEFAULT 'admin'");
addColumn('users', 'display_name', "TEXT");
addColumn('users', 'avatar', "TEXT");
addColumn('users', 'telegram', "TEXT");
addColumn('users', 'is_verified', "INTEGER DEFAULT 1");
addColumn('users', 'is_blocked', "INTEGER DEFAULT 0");
addColumn('users', 'block_reason', "TEXT");
addColumn('users', 'balance', "INTEGER DEFAULT 0");
addColumn('products', 'category', "TEXT DEFAULT 'Общее'");
addColumn('products', 'delivery_content', "TEXT");
addColumn('products', 'tags', "TEXT");
addColumn('products', 'is_pinned', "INTEGER DEFAULT 0");
addColumn('products', 'carousel_order', "INTEGER");
addColumn('products', 'badge', "TEXT");
addColumn('products', 'list_order', "INTEGER");
addColumn('articles', 'is_pinned', "INTEGER DEFAULT 0");
addColumn('articles', 'source_type', "TEXT");
addColumn('articles', 'source_url', "TEXT");
addColumn('comments', 'parent_id', "INTEGER REFERENCES comments(id) ON DELETE CASCADE");
addColumn('notifications', 'payload', "TEXT");
addColumn('users', 'created_at', "DATETIME");
addColumn('payment_pending', 'product_id', "INTEGER");
addColumn('users', 'telegram_id', "INTEGER");
try {
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)").run();
} catch (_) {}

// Ensure users.created_at exists (idempotent; SQLite ALTER doesn't allow CURRENT_TIMESTAMP default)
try {
  db.prepare("ALTER TABLE users ADD COLUMN created_at DATETIME").run();
  console.log("Added column created_at to users");
} catch (e: any) {
  if (!String(e?.message || "").toLowerCase().includes("duplicate column name")) {
    throw e;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS payment_pending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount_rub INTEGER NOT NULL,
    platega_transaction_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    delivery_content TEXT,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS delivery_tokens (
    token TEXT PRIMARY KEY,
    product_id INTEGER NOT NULL,
    delivery_content TEXT,
    product_name TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Миграция: минимум пополнения по умолчанию 1 ₽ (раньше было 100)
try {
  db.prepare("UPDATE settings SET value = '1' WHERE key = 'min_topup_amount' AND value = '100'").run();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('min_topup_amount', '1')").run();
} catch (_) {}

// Add default superadmin if not exists (ExamsFlow / 12345678)
const adminExists = db.prepare("SELECT * FROM users WHERE LOWER(username) = 'examsflow'").get();
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync("12345678", 10);
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("ExamsFlow", hashedPassword, 'superadmin');
}

// Promote 'admin' to superadmin if it exists
const adminUser = db.prepare("SELECT * FROM users WHERE LOWER(username) = 'admin'").get() as any;
if (adminUser && adminUser.role !== 'superadmin') {
  db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(adminUser.id);
  console.log("Promoted 'admin' to superadmin");
}

// Initialize settings
const initSetting = (key: string, defaultValue: string) => {
  const exists = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
  if (!exists) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, defaultValue);
  }
};

initSetting('privacy_policy', '# Политика конфиденциальности\n\nВаши данные в безопасности.');
initSetting('user_agreement', '# Пользовательское соглашение\n\nИспользуя этот сайт, вы соглашаетесь с правилами.');

// Add sample data if empty
const count = (db.prepare("SELECT COUNT(*) as count FROM articles").get() as { count: number }).count;
if (count === 0) {
  const insert = db.prepare("INSERT INTO articles (title, slug, content, category, author) VALUES (?, ?, ?, ?, ?)");
  insert.run(
    "Тренировочная работа №2 по математике профиль 11 класс 18.12.2025: задания с ответами",
    "math-pro-11-2025",
    "# Математика Профиль 11 класс\n\n## Задание 1\nРешите уравнение: 2x + 5 = 15\n\n**Решение:**\n2x = 10\nx = 5\n\n## Задание 2\nНайдите производную функции f(x) = x^2.\n\n**Решение:**\nf'(x) = 2x",
    "Математика",
    "Иван Иванов"
  );
}

// Multer config for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use('/uploads', express.static(uploadsDir));
  app.set("trust proxy", 1);

  app.use((req: any, _res, next) => {
    req.user = userFromToken(req);
    next();
  });

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user) {
      next();
    } else {
      res.status(401).json({ error: "Необходима авторизация" });
    }
  };

  const getAdminUserIds = (): number[] => {
    const rows = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'superadmin')").all() as { id: number }[];
    return rows.map((r) => r.id);
  };

  const createNotificationForAdmins = (type: string, title: string, body: string, link?: string, payload?: string) => {
    const adminIds = getAdminUserIds();
    const insert = db.prepare(
      "INSERT INTO notifications (user_id, type, title, body, link, payload) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const uid of adminIds) {
      insert.run(uid, type, title, body || "", link || null, payload || null);
    }
  };

  // Auth Routes — JWT в ответе, клиент хранит в localStorage
  function toUserDto(user: any) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
      avatar: user.avatar,
      telegram: user.telegram,
      is_verified: user.is_verified === 1,
      is_blocked: user.is_blocked === 1,
      block_reason: user.block_reason,
      balance: user.balance,
      created_at: user.created_at || null,
    };
  }

  app.post("/api/register", (req: any, res: any) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const info = db.prepare("INSERT INTO users (username, password, display_name, role, created_at) VALUES (?, ?, ?, 'user', datetime('now'))").run(username, hashedPassword, username);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as any;
      createNotificationForAdmins("user", "Новый пользователь", `Зарегистрирован: ${username}`, "/admin");
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      res.json({ success: true, user: toUserDto(user), token });
    } catch (err) {
      res.status(400).json({ error: "Имя пользователя уже занято" });
    }
  });

  app.post("/api/login", (req: any, res: any) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(username) as any;
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      res.json({ success: true, user: toUserDto(user), token });
    } else {
      res.status(401).json({ error: "Неверный логин или пароль" });
    }
  });

  app.post("/api/logout", (_req, res) => {
    res.json({ success: true });
  });

  function verifyTelegramAuth(payload: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: number; hash: string }): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return false;
    const { hash, ...rest } = payload;
    const dataCheckString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${(rest as any)[k]}`)
      .join("\n");
    const secretKey = crypto.createHash("sha256").update(botToken).digest();
    const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (hmac !== hash) return false;
    const maxAge = 86400;
    if (Math.floor(Date.now() / 1000) - payload.auth_date > maxAge) return false;
    return true;
  }

  app.post("/api/auth/telegram", (req: any, res: any) => {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body || {};
    if (!id || !auth_date || !hash) {
      return res.status(400).json({ error: "Неверные данные от Telegram" });
    }
    if (!verifyTelegramAuth({ id: Number(id), first_name, last_name, username, photo_url, auth_date: Number(auth_date), hash })) {
      return res.status(400).json({ error: "Проверка подписи Telegram не прошла" });
    }
    const telegramId = Number(id);
    const displayName = [first_name, last_name].filter(Boolean).join(" ").trim() || username || `User ${telegramId}`;
    const baseUsername = (username && String(username).replace(/[^a-zA-Z0-9_]/g, "")) || `tg_${telegramId}`;
    let finalUsername = baseUsername;
    let n = 0;
    while (db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND (telegram_id IS NULL OR telegram_id != ?)").get(finalUsername, telegramId)) {
      n++;
      finalUsername = `${baseUsername}_${n}`;
    }
    let user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId) as any;
    if (user) {
      db.prepare(
        "UPDATE users SET username = ?, display_name = ?, avatar = ?, telegram = ? WHERE id = ?"
      ).run(finalUsername, displayName || user.display_name, photo_url || user.avatar, username || user.telegram || "", user.id);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as any;
    } else {
      const placeholderPassword = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10);
      try {
        db.prepare(
          "INSERT INTO users (username, password, display_name, avatar, telegram, telegram_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?, 'user', datetime('now'))"
        ).run(finalUsername, placeholderPassword, displayName, photo_url || null, username || null, telegramId);
        const newId = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(newId.id) as any;
        createNotificationForAdmins("user", "Новый пользователь", `Зарегистрирован через Telegram: ${displayName} (@${username || "—"})`, "/admin");
      } catch (e: any) {
        if (e.message && e.message.includes("UNIQUE")) {
          user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId) as any;
          if (user) {
            db.prepare("UPDATE users SET username = ?, display_name = ?, avatar = ?, telegram = ? WHERE id = ?").run(finalUsername, displayName, photo_url, username, user.id);
            user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as any;
          } else return res.status(400).json({ error: "Ошибка создания аккаунта" });
        } else throw e;
      }
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ success: true, user: toUserDto(user), token });
  });

  app.get("/api/me", (req: any, res: any) => {
    res.json({ user: req.user || null });
  });

  app.get("/api/articles", (req, res) => {
    const articles = db.prepare("SELECT id, title, slug, category, author, views, created_at, is_pinned FROM articles ORDER BY is_pinned DESC, created_at DESC").all();
    res.json(articles);
  });

  app.get("/api/articles/:slug", (req, res) => {
    const article = db.prepare("SELECT * FROM articles WHERE slug = ?").get(req.params.slug);
    if (!article) return res.status(404).json({ error: "Статья не найдена" });
    res.json(article);
  });

  // View tracking with rate limiting (in-memory by IP)
  app.post("/api/articles/:slug/view", (req: any, res) => {
    const slug = req.params.slug;
    const now = Date.now();
    const ip = (req.ip || req.socket?.remoteAddress || "unknown") + ":" + slug;
    const lastView = viewLimitStore.get(ip) || 0;
    if (now - lastView > 5000) {
      db.prepare("UPDATE articles SET views = views + 1 WHERE slug = ?").run(slug);
      viewLimitStore.set(ip, now);
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Too soon" });
    }
  });

  app.get("/api/authors/:username", (req, res) => {
    const user = db.prepare("SELECT id, username, display_name, avatar, telegram, is_verified, is_blocked, created_at FROM users WHERE LOWER(username) = LOWER(?)").get(req.params.username) as any;
    if (!user) return res.status(404).json({ error: "Автор не найден" });
    const purchaseCount = db.prepare("SELECT COUNT(*) as c FROM purchases WHERE user_id = ?").get(user.id) as { c: number };
    if (user.is_blocked) {
      return res.json({
        username: user.username,
        display_name: "Заблокированный пользователь",
        avatar: "/blocked-user.png",
        telegram: "",
        is_verified: false,
        is_blocked: true,
        purchase_count: 0,
        created_at: user.created_at || null
      });
    }
    res.json({
      username: user.username,
      display_name: user.display_name,
      avatar: user.avatar,
      telegram: user.telegram,
      is_verified: user.is_verified === 1,
      is_blocked: false,
      purchase_count: purchaseCount?.c ?? 0,
      created_at: user.created_at || null
    });
  });

  // Captcha — храним в памяти по id (без сессии)
  app.get("/api/captcha", (_req, res) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let captcha = "";
    for (let i = 0; i < 5; i++) {
      captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const captchaId = crypto.randomUUID();
    captchaStore.set(captchaId, captcha);
    setTimeout(() => captchaStore.delete(captchaId), 5 * 60 * 1000);
    res.json({ captchaId, captcha });
  });

  // Comments
  app.get("/api/articles/:slug/comments", (req, res) => {
    const article = db.prepare("SELECT id FROM articles WHERE slug = ?").get(req.params.slug) as any;
    if (!article) return res.json([]);
    
    const comments = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar, u.is_verified, u.is_blocked
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.article_id = ? AND c.status = 'approved'
      ORDER BY c.created_at DESC
    `).all(article.id).map((c: any) => {
      if (c.is_blocked) {
        return { ...c, display_name: "Заблокированный пользователь", avatar: "/blocked-user.png" };
      }
      return c;
    });
    res.json(comments);
  });

  app.post("/api/comments", (req: any, res) => {
    if (!req.user) return res.status(401).json({ error: "Авторизуйтесь" });
    if (req.user.is_blocked) return res.status(403).json({ error: "Вы заблокированы" });
    const { article_id, content, captcha, captchaId } = req.body;
    const expected = captchaId ? captchaStore.get(captchaId) : null;
    if (!expected || captcha !== expected) {
      if (captchaId) captchaStore.delete(captchaId);
      return res.status(400).json({ error: "Неверная капча" });
    }
    captchaStore.delete(captchaId);
    db.prepare("INSERT INTO comments (article_id, user_id, content) VALUES (?, ?, ?)").run(article_id, req.user.id, content);
    const article = db.prepare("SELECT slug, title FROM articles WHERE id = ?").get(article_id) as { slug: string; title: string } | undefined;
    const displayName = req.user.display_name || req.user.username || "Пользователь";
    createNotificationForAdmins(
      "comment",
      "Новый комментарий",
      `${displayName} оставил комментарий к «${article?.title || "статья"}»`,
      article?.slug ? `/article/${article.slug}` : undefined
    );
    res.json({ success: true, message: "Комментарий отправлен на модерацию" });
  });

  app.post("/api/admin/comments/:id/reply", isAdmin, (req: any, res) => {
    const parentId = parseInt(req.params.id, 10);
    const { content } = req.body || {};
    if (!content || !String(content).trim()) return res.status(400).json({ error: "Введите ответ" });
    const parent = db.prepare("SELECT id, article_id FROM comments WHERE id = ?").get(parentId) as any;
    if (!parent) return res.status(404).json({ error: "Комментарий не найден" });
    db.prepare(
      "INSERT INTO comments (article_id, user_id, content, status, parent_id) VALUES (?, ?, ?, 'approved', ?)"
    ).run(parent.article_id, req.user.id, String(content).trim(), parentId);
    res.json({ success: true });
  });

  // Reviews (approved only for public list)
  app.get("/api/reviews", (req, res) => {
    const rows = db.prepare(`
      SELECT r.id, r.user_id, r.content, r.status, r.created_at,
             u.username, u.display_name, u.avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'approved'
      ORDER BY r.created_at DESC
    `).all() as any[];
    const reviews = rows.map((r) => {
      const lastPurchase = db.prepare(`
        SELECT p.name
        FROM purchases pur
        LEFT JOIN products p ON pur.product_id = p.id
        WHERE pur.user_id = ?
        ORDER BY pur.purchased_at DESC
        LIMIT 1
      `).get(r.user_id) as { name: string } | undefined;
      const purchaseCount = db.prepare("SELECT COUNT(*) as c FROM purchases WHERE user_id = ?").get(r.user_id) as { c: number };
      return {
        id: r.id,
        user_id: r.user_id,
        username: r.username,
        display_name: r.display_name || r.username,
        avatar: r.avatar,
        content: r.content,
        created_at: r.created_at,
        last_purchase_name: lastPurchase?.name || null,
        purchase_count: purchaseCount?.c ?? 0,
      };
    });
    res.json(reviews);
  });

  app.post("/api/reviews", (req: any, res) => {
    if (!req.user) return res.status(401).json({ error: "Авторизуйтесь" });
    if (req.user.is_blocked) return res.status(403).json({ error: "Вы заблокированы" });
    const { content } = req.body || {};
    if (!content || !String(content).trim()) return res.status(400).json({ error: "Введите текст отзыва" });
    db.prepare("INSERT INTO reviews (user_id, content, status) VALUES (?, ?, 'pending')").run(req.user.id, String(content).trim());
    const displayName = req.user.display_name || req.user.username || "Пользователь";
    createNotificationForAdmins("comment", "Новый отзыв", `${displayName} оставил отзыв на модерацию`, "/admin");
    res.json({ success: true, message: "Отзыв отправлен на модерацию" });
  });

  app.get("/api/admin/reviews", isAdmin, (req, res) => {
    const rows = db.prepare(`
      SELECT r.id, r.user_id, r.content, r.status, r.created_at,
             u.username, u.display_name, u.avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `).all() as any[];
    const reviews = rows.map((r) => {
      const purchaseCount = db.prepare("SELECT COUNT(*) as c FROM purchases WHERE user_id = ?").get(r.user_id) as { c: number };
      const lastPurchase = db.prepare(`
        SELECT p.name FROM purchases pur
        LEFT JOIN products p ON pur.product_id = p.id
        WHERE pur.user_id = ? ORDER BY pur.purchased_at DESC LIMIT 1
      `).get(r.user_id) as { name: string } | undefined;
      return {
        id: r.id,
        user_id: r.user_id,
        username: r.username,
        display_name: r.display_name || r.username,
        avatar: r.avatar,
        content: r.content,
        status: r.status,
        created_at: r.created_at,
        purchase_count: purchaseCount?.c ?? 0,
        last_purchase_name: lastPurchase?.name || null,
      };
    });
    res.json(reviews);
  });

  app.put("/api/admin/reviews/:id", isAdmin, (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body || {};
    if (!["pending", "approved", "rejected"].includes(status)) return res.status(400).json({ error: "Недопустимый статус" });
    const row = db.prepare("SELECT id FROM reviews WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Отзыв не найден" });
    db.prepare("UPDATE reviews SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.get("/api/settings/:key", (req, res) => {
    const setting = db.prepare("SELECT value FROM settings WHERE key = ?").get(req.params.key) as any;
    res.json({ value: setting?.value || "" });
  });

  app.get("/api/config", (_req, res) => {
    const telegramBotName = process.env.TELEGRAM_BOT_NAME || (db.prepare("SELECT value FROM settings WHERE key = ?").get("telegram_bot_name") as { value?: string } | undefined)?.value || "";
    res.json({ telegramBotName });
  });

  const getBaseUrl = (req: express.Request) => {
    const origin = process.env.SITE_URL || (req.protocol + "://" + req.get("host"));
    return origin.replace(/\/$/, "");
  };

  const sitemapPath = path.join(__dirname, "public", "sitemap.xml");
  function regenerateSitemapFile() {
    try {
      const base = (process.env.SITE_URL || "https://example.com").replace(/\/$/, "");
      const articles = db.prepare("SELECT slug, created_at FROM articles ORDER BY created_at DESC").all() as { slug: string; created_at: string }[];
      const staticPages = [
        { path: "", priority: "1.0", changefreq: "daily" },
        { path: "/products", priority: "0.9", changefreq: "daily" },
        { path: "/reviews", priority: "0.8", changefreq: "weekly" },
        { path: "/contacts", priority: "0.6", changefreq: "monthly" },
        { path: "/privacy", priority: "0.3", changefreq: "monthly" },
        { path: "/terms", priority: "0.3", changefreq: "monthly" },
      ];
      const lastmod = (d: string) => (d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      const url = (p: string, lm: string, pr: string, cf: string) =>
        `  <url><loc>${base}${p}</loc><lastmod>${lm}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`;
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        staticPages.map((s) => url(s.path || "/", lastmod(""), s.priority, s.changefreq)).join("\n") +
        "\n" +
        articles.map((a) => url(`/article/${a.slug}`, lastmod(a.created_at), "0.8", "weekly")).join("\n") +
        "\n</urlset>";
      fs.writeFileSync(sitemapPath, xml, "utf8");
    } catch (err) {
      console.error("Failed to regenerate sitemap.xml:", err);
    }
  }

  app.get("/robots.txt", (req, res) => {
    const base = getBaseUrl(req);
    res.type("text/plain");
    res.send(
      `User-agent: *\n` +
      `Allow: /\n` +
      `Disallow: /admin\n` +
      `Disallow: /admin/\n` +
      `Disallow: /auth\n` +
      `Disallow: /api/\n` +
      `Disallow: /topup\n` +
      `Disallow: /notifications\n` +
      `\nSitemap: ${base}/sitemap.xml\n`
    );
  });

  app.get("/sitemap.xml", (req, res) => {
    const base = getBaseUrl(req);
    const articles = db.prepare("SELECT slug, created_at FROM articles ORDER BY created_at DESC").all() as { slug: string; created_at: string }[];
    const staticPages = [
      { path: "", priority: "1.0", changefreq: "daily" },
      { path: "/products", priority: "0.9", changefreq: "daily" },
      { path: "/reviews", priority: "0.8", changefreq: "weekly" },
      { path: "/contacts", priority: "0.6", changefreq: "monthly" },
      { path: "/privacy", priority: "0.3", changefreq: "monthly" },
      { path: "/terms", priority: "0.3", changefreq: "monthly" },
    ];
    const lastmod = (d: string) => (d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    const url = (path: string, lm: string, pr: string, cf: string) =>
      `  <url><loc>${base}${path}</loc><lastmod>${lm}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`;
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      staticPages.map((p) => url(p.path || "/", lastmod(""), p.priority, p.changefreq)).join("\n") +
      "\n" +
      articles.map((a) => url(`/article/${a.slug}`, lastmod(a.created_at), "0.8", "weekly")).join("\n") +
      "\n</urlset>";
    res.type("application/xml");
    res.send(xml);
  });

  // Admin Routes
  app.post("/api/admin/articles", isAdmin, (req, res) => {
    const { title, content, category, author, source_type, source_url } = req.body;
    let slug = req.body.slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    
    let finalSlug = slug;
    let counter = 1;
    while (db.prepare("SELECT id FROM articles WHERE slug = ?").get(finalSlug)) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    try {
      const st = source_type === 'telegram' ? 'telegram' : null;
      const su = source_url && String(source_url).trim() ? String(source_url).trim() : null;
      db.prepare(
        "INSERT INTO articles (title, slug, content, category, author, source_type, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(title, finalSlug, content, category || 'Общее', author || 'Администратор', st, su);
      const id = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
      regenerateSitemapFile();
      res.json({ id: id.id, slug: finalSlug });
    } catch (err) {
      res.status(400).json({ error: "Ошибка при создании статьи" });
    }
  });

  app.put("/api/admin/articles/:id", isAdmin, (req, res) => {
    const { title, slug, content, category, author, is_pinned, source_type, source_url } = req.body;
    
    const existing = db.prepare("SELECT id FROM articles WHERE slug = ? AND id != ?").get(slug, req.params.id);
    if (existing) {
      return res.status(400).json({ error: "Этот Slug уже занят другой статьей" });
    }

    try {
      const st = source_type === 'telegram' ? 'telegram' : null;
      const su = source_url && String(source_url).trim() ? String(source_url).trim() : null;
      db.prepare(
        "UPDATE articles SET title = ?, slug = ?, content = ?, category = ?, author = ?, is_pinned = ?, source_type = ?, source_url = ? WHERE id = ?"
      ).run(title, slug, content, category, author, is_pinned ? 1 : 0, st, su, req.params.id);
      regenerateSitemapFile();
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Ошибка при обновлении статьи" });
    }
  });

  app.delete("/api/admin/articles/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
    regenerateSitemapFile();
    res.json({ success: true });
  });

  const getSetting = (key: string, defaultValue: string): string => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return (row?.value ?? defaultValue).trim() || defaultValue;
  };

  const getPlategaConfig = () => ({
    base: (getSetting("platega_base_url", "") || process.env.PLATEGA_BASE_URL || "https://app.platega.io").replace(/\/$/, ""),
    merchant: getSetting("platega_merchant_id", "") || process.env.PLATEGA_MERCHANT_ID || "",
    secret: getSetting("platega_secret", "") || process.env.PLATEGA_SECRET || "",
    webhookSecret: getSetting("platega_webhook_secret", "") || process.env.PLATEGA_WEBHOOK_SECRET || "",
    demo: getSetting("platega_demo", "") === "1",
  });

  const createDeliveryToken = (productId: number, userId: number | null): string | null => {
    const product = db.prepare("SELECT id, name, delivery_content FROM products WHERE id = ?").get(productId) as { id: number; name: string; delivery_content: string | null } | undefined;
    if (!product) return null;
    const token = crypto.randomBytes(24).toString("hex");
    db.prepare("INSERT INTO delivery_tokens (token, product_id, delivery_content, product_name, user_id) VALUES (?, ?, ?, ?, ?)").run(token, productId, product.delivery_content ?? null, product.name, userId);
    return token;
  };

  app.put("/api/admin/settings/:key", isAdmin, (req, res) => {
    const { value } = req.body;
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(req.params.key, String(value ?? ""));
    res.json({ success: true });
  });

  app.post("/api/admin/upload", isAdmin, upload.single('image'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "Файл не загружен" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  app.get("/api/admin/stats", isAdmin, (req, res) => {
    const articleCount = db.prepare("SELECT COUNT(*) as count FROM articles").get() as any;
    const totalViews = db.prepare("SELECT SUM(views) as count FROM articles").get() as any;
    const latestArticle = db.prepare("SELECT created_at FROM articles ORDER BY created_at DESC LIMIT 1").get() as any;
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;
    const purchaseCount = db.prepare("SELECT COUNT(*) as count FROM purchases").get() as any;
    const commentCount = db.prepare("SELECT COUNT(*) as count FROM comments").get() as any;
    const pendingComments = db.prepare("SELECT COUNT(*) as count FROM comments WHERE status = 'pending'").get() as any;
    const pendingReviews = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE status = 'pending'").get() as any;
    const totalRevenue = db.prepare(`
      SELECT COALESCE(SUM(p.price * pur.quantity), 0) as total FROM purchases pur
      LEFT JOIN products p ON pur.product_id = p.id
    `).get() as any;
    const topArticle = db.prepare("SELECT title, views FROM articles ORDER BY views DESC LIMIT 1").get() as any;
    res.json({
      totalArticles: Number(articleCount?.count ?? 0),
      totalViews: Number(totalViews?.count ?? 0),
      lastUpdate: latestArticle?.created_at || null,
      totalUsers: Number(userCount?.count ?? 0),
      totalProducts: Number(productCount?.count ?? 0),
      totalPurchases: Number(purchaseCount?.count ?? 0),
      totalComments: Number(commentCount?.count ?? 0),
      pendingComments: Number(pendingComments?.count ?? 0),
      pendingReviews: Number(pendingReviews?.count ?? 0),
      totalRevenue: Number(totalRevenue?.total ?? 0),
      topArticle: topArticle || null
    });
  });

  // User Management
  app.get("/api/admin/users", isAdmin, (req, res) => {
    const users = db.prepare("SELECT id, username, role, display_name, avatar, telegram, is_verified, is_blocked, block_reason, balance FROM users").all();
    res.json(users);
  });

  app.put("/api/admin/users/:id", isAdmin, (req: any, res) => {
    const { display_name, avatar, telegram, role, is_verified, is_blocked, block_reason, balance } = req.body;
    
    // Only superadmin can change roles, verified status, block, or balance
    const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: "Пользователь не найден" });

    if (req.user.role !== 'superadmin') {
      if (role || is_verified !== undefined || is_blocked !== undefined || balance !== undefined) {
        return res.status(403).json({ error: "Нет прав для изменения системных статусов" });
      }
      if (req.user.id !== parseInt(req.params.id)) {
        return res.status(403).json({ error: "Нет прав редактировать чужой профиль" });
      }
    }

    const updatedDisplayName = display_name !== undefined ? display_name : targetUser.display_name;
    const updatedAvatar = avatar !== undefined ? avatar : targetUser.avatar;
    const updatedTelegram = telegram !== undefined ? telegram : targetUser.telegram;
    const updatedRole = (req.user.role === 'superadmin' && role !== undefined) ? role : targetUser.role;
    const updatedVerified = (req.user.role === 'superadmin' && is_verified !== undefined) ? is_verified : targetUser.is_verified;
    const updatedBlocked = (req.user.role === 'superadmin' && is_blocked !== undefined) ? is_blocked : targetUser.is_blocked;
    const updatedBlockReason = (req.user.role === 'superadmin' && block_reason !== undefined) ? block_reason : targetUser.block_reason;
    const parsedBalance = parseInt(String(balance), 10);
    const updatedBalance = (req.user.role === 'superadmin' && balance !== undefined)
      ? (Number.isFinite(parsedBalance) ? Math.max(0, parsedBalance) : targetUser.balance)
      : targetUser.balance;

    db.prepare("UPDATE users SET display_name = ?, avatar = ?, telegram = ?, role = ?, is_verified = ?, is_blocked = ?, block_reason = ?, balance = ? WHERE id = ?")
      .run(updatedDisplayName, updatedAvatar, updatedTelegram, updatedRole, updatedVerified, updatedBlocked, updatedBlockReason, updatedBalance, req.params.id);
    
    res.json({ success: true });
  });

  // Products API
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY (carousel_order IS NULL), carousel_order ASC, (list_order IS NULL), list_order ASC, is_pinned DESC, id ASC").all();
    res.json(products);
  });

  app.get("/api/products/carousel", (req, res) => {
    const products = db.prepare("SELECT * FROM products WHERE carousel_order IS NOT NULL ORDER BY carousel_order ASC").all();
    res.json(products);
  });

  app.get("/api/products/categories", (req, res) => {
    const rows = db.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' ORDER BY category").all() as { category: string }[];
    res.json(rows.map(r => r.category));
  });

  app.get("/api/products/:id", (req, res) => {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!product) return res.status(404).json({ error: "Товар не найден" });
    res.json(product);
  });

  app.post("/api/admin/products", isAdmin, (req, res) => {
    const { name, description, price, image, category, delivery_content, tags, carousel_order, badge } = req.body;
    try {
      const info = db.prepare("INSERT INTO products (name, description, price, image, category, delivery_content, tags, carousel_order, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(name, description, price, image, category || 'Общее', delivery_content || null, tags || null, carousel_order != null ? parseInt(carousel_order, 10) : null, badge || null);
      res.json({ id: info.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: "Ошибка при создании товара" });
    }
  });

  app.put("/api/admin/products/:id", isAdmin, (req, res) => {
    const { name, description, price, image, category, delivery_content, tags, is_pinned, carousel_order, badge } = req.body;
    try {
      const co = carousel_order === '' || carousel_order === undefined || carousel_order === null ? null : parseInt(carousel_order, 10);
      db.prepare("UPDATE products SET name = ?, description = ?, price = ?, image = ?, category = ?, delivery_content = ?, tags = ?, is_pinned = ?, carousel_order = ?, badge = ? WHERE id = ?").run(name, description, price, image, category || 'Общее', delivery_content || null, tags || null, is_pinned ? 1 : 0, co, badge || null, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Ошибка при обновлении товара" });
    }
  });

  app.patch("/api/admin/products/:id/reorder", isAdmin, (req, res) => {
    const { direction } = req.body; // 'up' | 'down'
    const id = parseInt(req.params.id, 10);
    const current = db.prepare("SELECT id, carousel_order, list_order FROM products WHERE id = ?").get(id) as { id: number; carousel_order: number | null; list_order: number | null } | undefined;
    if (!current) return res.status(404).json({ error: "Товар не найден" });

    if (current.carousel_order != null) {
      const all = db.prepare("SELECT id, carousel_order FROM products WHERE carousel_order IS NOT NULL ORDER BY carousel_order ASC").all() as { id: number; carousel_order: number }[];
      const idx = all.findIndex(p => p.id === id);
      if (idx < 0) return res.status(400).json({ error: "Товар не найден в карусели" });
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= all.length) return res.json({ success: true });
      const other = all[swapIdx];
      db.prepare("UPDATE products SET carousel_order = ? WHERE id = ?").run(other.carousel_order, id);
      db.prepare("UPDATE products SET carousel_order = ? WHERE id = ?").run(current.carousel_order, other.id);
      return res.json({ success: true });
    }

    const listRows = db.prepare("SELECT id, list_order FROM products WHERE carousel_order IS NULL ORDER BY (list_order IS NULL), list_order ASC, id ASC").all() as { id: number; list_order: number | null }[];
    const listIdx = listRows.findIndex(p => p.id === id);
    if (listIdx < 0) return res.json({ success: true });
    const swapListIdx = direction === 'up' ? listIdx - 1 : listIdx + 1;
    if (swapListIdx < 0 || swapListIdx >= listRows.length) return res.json({ success: true });
    const otherRow = listRows[swapListIdx];
    const curOrder = current.list_order ?? current.id;
    const otherOrder = otherRow.list_order ?? otherRow.id;
    db.prepare("UPDATE products SET list_order = ? WHERE id = ?").run(otherOrder, id);
    db.prepare("UPDATE products SET list_order = ? WHERE id = ?").run(curOrder, otherRow.id);
    res.json({ success: true });
  });

  app.delete("/api/admin/products/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Cart API — GET без авторизации возвращает пустой массив (без 401)
  app.get("/api/cart", (req: any, res) => {
    if (!req.user?.id) return res.json([]);
    const items = db.prepare(`
      SELECT c.*, p.name, p.price, p.image
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `).all(req.user.id);
    res.json(items);
  });

  app.post("/api/cart", isAdmin, (req: any, res) => {
    const { product_id, quantity = 1 } = req.body;
    const existing = db.prepare("SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?").get(req.user.id, product_id) as any;
    
    if (existing) {
      db.prepare("UPDATE cart SET quantity = quantity + ? WHERE id = ?").run(quantity, existing.id);
    } else {
      db.prepare("INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)").run(req.user.id, product_id, quantity);
    }
    res.json({ success: true });
  });

  app.delete("/api/cart/:id", isAdmin, (req: any, res) => {
    db.prepare("DELETE FROM cart WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.post("/api/cart/checkout", isAdmin, (req: any, res) => {
    const userId = req.user.id;
    const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(userId) as any;
    const cartItems = db.prepare(`
      SELECT c.quantity, c.product_id, p.price, p.name as product_name, p.delivery_content
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `).all(userId) as any[];

    const total = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const balanceAfter = (user.balance as number) - total;

    if (user.balance < total) {
      return res.status(400).json({ error: "Недостаточно средств на балансе" });
    }

    db.transaction(() => {
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(total, userId);
      for (const item of cartItems) {
        for (let i = 0; i < item.quantity; i++) {
          db.prepare("INSERT INTO purchases (user_id, product_id, quantity, delivery_content) VALUES (?, ?, 1, ?)").run(userId, item.product_id, item.delivery_content);
        }
      }
      db.prepare("DELETE FROM cart WHERE user_id = ?").run(userId);
    })();

    const buyer = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(userId) as { username: string; display_name: string };
    const name = buyer?.display_name || buyer?.username || "Пользователь";
    const productNames = cartItems.map((i: any) => `${i.product_name || "Товар"}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).filter(Boolean);
    const purchasePayload = JSON.stringify({
      userId,
      username: buyer?.username,
      displayName: name,
      total,
      balanceAfter,
      productNames,
      purchasedAt: new Date().toISOString(),
    });
    createNotificationForAdmins("purchase", "Новая покупка", `${name} совершил покупку на ${total} ₽`, "/admin", purchasePayload);
    req.user.balance -= total;
    res.json({ success: true, newBalance: req.user.balance });
  });

  app.get("/api/purchases", isAdmin, (req: any, res) => {
    const purchases = db.prepare(`
      SELECT p.*, pr.name, pr.image, pr.description
      FROM purchases p
      LEFT JOIN products pr ON p.product_id = pr.id
      WHERE p.user_id = ?
      ORDER BY p.purchased_at DESC
    `).all(req.user.id);
    res.json(purchases);
  });

  app.post("/api/balance/topup", isAdmin, (req: any, res) => {
    let minRaw = getSetting("min_topup_amount", "1");
    if (minRaw === "100") minRaw = "1"; // старый дефолт
    const minTopUp = Math.max(1, parseInt(minRaw, 10) || 1);
    const { amount } = req.body;
    const amt = parseInt(amount);
    if (!amount || amt < minTopUp) return res.status(400).json({ error: `Минимальная сумма пополнения — ${minTopUp} ₽` });
    
    db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(amt, req.user.id);
    req.user.balance = (req.user.balance || 0) + amt;
    const who = req.user.display_name || req.user.username || "Пользователь";
    createNotificationForAdmins("topup", "Пополнение баланса", `${who} пополнил баланс на ${amt} ₽`, "/admin");
    res.json({ success: true, newBalance: req.user.balance });
  });
  app.get("/api/notifications", isAdmin, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Доступ только для администраторов" });
    }
    const category = (req.query.category as string) || "all";
    let list = db.prepare(
      "SELECT id, type, title, body, link, read, created_at, payload FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200"
    ).all(req.user.id) as { id: number; type: string; title: string; body: string; link: string | null; read: number; created_at: string; payload: string | null }[];
    if (category === "market") {
      list = list.filter((n) => n.type === "purchase" || n.type === "topup");
    } else if (category === "other") {
      list = list.filter((n) => n.type === "comment" || n.type === "user");
    }
    res.json(list);
  });

  app.get("/api/notifications/unread-count", isAdmin, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.json({ count: 0 });
    }
    const row = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0").get(req.user.id) as { c: number };
    res.json({ count: row?.c ?? 0 });
  });

  app.patch("/api/notifications/:id/read", isAdmin, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Доступ только для администраторов" });
    }
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.patch("/api/notifications/read-all", isAdmin, (req: any, res) => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Доступ только для администраторов" });
    }
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(req.user.id);
    res.json({ success: true });
  });

  app.get("/api/admin/comments", isAdmin, (req, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.username, u.display_name, a.title as article_title
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN articles a ON c.article_id = a.id
      ORDER BY c.created_at DESC
    `).all();
    res.json(comments);
  });

  app.put("/api/admin/comments/:id", isAdmin, (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE comments SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/admin/comments/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/admin/users", isAdmin, (req, res) => {
    const { username, password, role } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare("INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, datetime('now'))").run(username, hashedPassword, role || 'admin');
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Пользователь уже существует" });
    }
  });

  app.put("/api/admin/users/:id/password", isAdmin, (req: any, res) => {
    const { password } = req.body;
    // Only superadmin can change others' passwords, or user can change their own
    if (req.user.role !== 'superadmin' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: "Нет прав" });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:id", isAdmin, (req: any, res) => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Только главный админ может удалять пользователей" });
    }
    if (req.user.id === parseInt(req.params.id)) {
      return res.status(400).json({ error: "Нельзя удалить самого себя" });
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/admin/payment-log", isAdmin, (req: any, res) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const offset = (page - 1) * limit;
    const total = (db.prepare("SELECT COUNT(*) as c FROM payment_pending").get() as { c: number }).c;
    const items = db.prepare(`
      SELECT pp.id, pp.user_id, pp.amount_rub, pp.platega_transaction_id, pp.status, pp.created_at,
             u.username, u.display_name
      FROM payment_pending pp
      LEFT JOIN users u ON pp.user_id = u.id
      ORDER BY pp.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];
    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  // Platega payment integration (config from settings with env fallback)
  const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

  const paymentMethodMap: Record<string, number> = {
    sbp: 2,
    card: 10,
    crypto: 13,
  };

  app.post("/api/payment/create", isAdmin, async (req: any, res) => {
    const cfg = getPlategaConfig();
    let minRaw = getSetting("min_topup_amount", "1");
    if (minRaw === "100") minRaw = "1"; // старый дефолт
    const minTopUp = Math.max(1, parseInt(minRaw, 10) || 1);
    const { amount, paymentMethod, product_id: productIdRaw } = req.body;
    const amt = parseInt(amount);
    const productId = productIdRaw != null ? parseInt(String(productIdRaw), 10) : null;
    if (productId != null) {
      const product = db.prepare("SELECT id, price, name, delivery_content FROM products WHERE id = ?").get(productId) as any;
      if (!product) return res.status(400).json({ error: "Товар не найден" });
      if (amt !== product.price) return res.status(400).json({ error: "Сумма должна совпадать с ценой товара" });
      if (cfg.demo) {
        const token = createDeliveryToken(productId, req.user.id);
        if (token) {
          db.prepare("INSERT INTO purchases (user_id, product_id, quantity, delivery_content) VALUES (?, ?, 1, ?)").run(req.user.id, productId, product.delivery_content ?? null);
          createNotificationForAdmins("purchase", "Оплата товара (демо)", `Пользователь получил товар в демо-режиме — ${amt} ₽`, "/admin");
          return res.json({ redirect: `${SITE_URL}/delivery/${token}`, delivery_token: token });
        }
      }
    } else {
      if (!amount || amt < minTopUp) {
        return res.status(400).json({ error: `Минимальная сумма пополнения — ${minTopUp} ₽` });
      }
    }
    const methodKey = typeof paymentMethod === "string" ? paymentMethod.toLowerCase() : "sbp";
    const plategaMethod = paymentMethodMap[methodKey] ?? 2;
    if (!cfg.merchant || !cfg.secret) {
      return res.status(503).json({ error: "Платёжная система не настроена. Заполните Merchant ID и Secret в разделе PLATEGA." });
    }
    const plategaHeaders = { "Content-Type": "application/json", "X-MerchantId": cfg.merchant, "X-Secret": cfg.secret };
    try {
      const returnUrl = productId != null ? `${SITE_URL}/topup/success?product_id=${productId}` : `${SITE_URL}/topup/success`;
      const failedUrl = productId != null ? `${SITE_URL}/products/${productId}?pay&failed=1` : `${SITE_URL}/topup?failed=1`;
      const description = productId != null
        ? `Оплата товара BossExam — ${amt} ₽`
        : `Пополнение баланса BossExam — ${amt} ₽`;
      const plategaRes = await fetch(`${cfg.base}/transaction/process`, {
        method: "POST",
        headers: plategaHeaders,
        body: JSON.stringify({
          paymentMethod: plategaMethod,
          paymentDetails: { amount: amt, currency: "RUB" },
          description,
          return: returnUrl,
          failedUrl,
          payload: String(req.user.id),
        }),
      });
      const data = await plategaRes.json();
      if (!plategaRes.ok) {
        return res.status(plategaRes.status).json({ error: data.message || "Ошибка платёжной системы" });
      }
      const transactionId = data.transactionId;
      if (!transactionId) {
        return res.status(500).json({ error: "Нет ссылки на оплату" });
      }
      db.prepare(
        "INSERT INTO payment_pending (user_id, amount_rub, platega_transaction_id, status, product_id) VALUES (?, ?, ?, 'PENDING', ?)"
      ).run(req.user.id, amt, transactionId, productId);
      // transactionId хранится в payment_pending по user_id
      res.json({
        redirect: data.redirect || data.payformSuccessUrl,
        transactionId,
        status: data.status,
      });
    } catch (err: any) {
      console.error("Platega create error:", err);
      res.status(500).json({ error: err.message || "Ошибка при создании платежа" });
    }
  });

  // Вебхук для Platega: сайт сам получает уведомление об оплате и пополняет баланс
  app.post("/api/payment/webhook", (req: any, res) => {
    const cfg = getPlategaConfig();
    if (cfg.webhookSecret && req.headers["x-webhook-secret"] !== cfg.webhookSecret) {
      return res.status(401).send("Unauthorized");
    }
    const { id, status, amount, currency } = req.body || {};
    if (!id || !status) {
      return res.status(400).send("Bad Request");
    }
    if (status !== "CONFIRMED") {
      return res.status(200).send("OK");
    }
    try {
      const row = db.prepare(
        "SELECT * FROM payment_pending WHERE platega_transaction_id = ? AND status = 'PENDING'"
      ).get(id) as any;
      if (row) {
        if (row.product_id) {
          const product = db.prepare("SELECT delivery_content FROM products WHERE id = ?").get(row.product_id) as { delivery_content: string } | undefined;
          db.prepare("INSERT INTO purchases (user_id, product_id, quantity, delivery_content) VALUES (?, ?, 1, ?)").run(row.user_id, row.product_id, product?.delivery_content ?? null);
          createDeliveryToken(row.product_id, row.user_id);
          createNotificationForAdmins("purchase", "Оплата товара", `Пользователь оплатил товар на ${row.amount_rub} ₽ (прямая ссылка)`, "/admin");
        } else {
          db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(row.amount_rub, row.user_id);
          const u = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(row.user_id) as { username: string; display_name: string };
          const name = u?.display_name || u?.username || "Пользователь";
          createNotificationForAdmins("topup", "Пополнение баланса", `${name} пополнил баланс на ${row.amount_rub} ₽ (оплата)`, "/admin");
        }
        db.prepare("UPDATE payment_pending SET status = 'CONFIRMED' WHERE id = ?").run(row.id);
      }
    } catch (err: any) {
      console.error("Payment webhook error:", err);
    }
    res.status(200).send("OK");
  });

  app.get("/api/delivery/:token", (req, res) => {
    const row = db.prepare("SELECT product_id, product_name, delivery_content FROM delivery_tokens WHERE token = ?").get(req.params.token) as { product_id: number; product_name: string; delivery_content: string | null } | undefined;
    if (!row) return res.status(404).json({ error: "Ссылка не найдена или устарела" });
    const product = db.prepare("SELECT image, price, category FROM products WHERE id = ?").get(row.product_id) as { image: string | null; price: number; category: string | null } | undefined;
    res.json({
      product_id: row.product_id,
      product_name: row.product_name,
      delivery_content: row.delivery_content,
      product_image: product?.image ?? null,
      product_price: product?.price ?? null,
      product_category: product?.category ?? null,
    });
  });

  app.get("/api/payment/check-return", isAdmin, async (req: any, res) => {
    let row = db.prepare("SELECT * FROM payment_pending WHERE user_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1").get(req.user.id) as any;
    const transactionId = row?.platega_transaction_id;
    if (!transactionId) {
      const confirmedRow = db.prepare("SELECT * FROM payment_pending WHERE user_id = ? AND status = 'CONFIRMED' AND product_id IS NOT NULL ORDER BY id DESC LIMIT 1").get(req.user.id) as any;
      if (confirmedRow) {
        const tok = db.prepare("SELECT token FROM delivery_tokens WHERE user_id = ? AND product_id = ? ORDER BY created_at DESC LIMIT 1").get(req.user.id, confirmedRow.product_id) as { token: string } | undefined;
        if (tok) return res.json({ status: "CONFIRMED", credited: true, product_id: confirmedRow.product_id, delivery_token: tok.token });
      }
      return res.json({ status: "NONE", credited: false });
    }
    const cfg = getPlategaConfig();
    if (!cfg.merchant || !cfg.secret) {
      return res.json({ status: "ERROR", error: "Платёжная система не настроена" });
    }
    const plategaHeaders = { "Content-Type": "application/json", "X-MerchantId": cfg.merchant, "X-Secret": cfg.secret };
    try {
      const plategaRes = await fetch(`${cfg.base}/transaction/${transactionId}`, {
        headers: plategaHeaders,
      });
      const data = await plategaRes.json();
      if (!plategaRes.ok) {
        // транзакция обработана в БД
        return res.json({ status: "ERROR", credited: false });
      }
      const status = data.status;
      if (status === "CONFIRMED") {
        const pendingRow = db.prepare("SELECT * FROM payment_pending WHERE platega_transaction_id = ? AND status = 'PENDING'").get(transactionId) as any;
        let deliveryToken: string | null = null;
        if (pendingRow) {
          if (pendingRow.product_id) {
            const product = db.prepare("SELECT delivery_content FROM products WHERE id = ?").get(pendingRow.product_id) as { delivery_content: string } | undefined;
            db.prepare("INSERT INTO purchases (user_id, product_id, quantity, delivery_content) VALUES (?, ?, 1, ?)").run(pendingRow.user_id, pendingRow.product_id, product?.delivery_content ?? null);
            deliveryToken = createDeliveryToken(pendingRow.product_id, pendingRow.user_id);
            createNotificationForAdmins("purchase", "Оплата товара", `Пользователь оплатил товар на ${pendingRow.amount_rub} ₽ (прямая ссылка)`, "/admin");
          } else {
            db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(pendingRow.amount_rub, pendingRow.user_id);
            const u = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(pendingRow.user_id) as { username: string; display_name: string };
            const name = u?.display_name || u?.username || "Пользователь";
            createNotificationForAdmins("topup", "Пополнение баланса", `${name} пополнил баланс на ${pendingRow.amount_rub} ₽ (оплата)`, "/admin");
          }
          db.prepare("UPDATE payment_pending SET status = 'CONFIRMED' WHERE id = ?").run(pendingRow.id);
          if (req.user && req.user.id === pendingRow.user_id && !pendingRow.product_id) {
            const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(pendingRow.user_id) as any;
            req.user.balance = user.balance;
          }
        }
        if (pendingRow && deliveryToken) return res.json({ status: "CONFIRMED", credited: true, product_id: pendingRow.product_id, delivery_token: deliveryToken });
        if (pendingRow) return res.json({ status: "CONFIRMED", credited: true, product_id: pendingRow.product_id ?? null });
        return res.json({ status: "CONFIRMED", credited: true, product_id: null });
      }
      if (status === "CANCELED" || status === "CHARGEBACKED") {
        // транзакция обработана в БД
      }
      return res.json({ status: status || "PENDING", credited: false });
    } catch (err: any) {
      console.error("Platega status error:", err);
      return res.json({ status: "ERROR", credited: false });
    }
  });

  regenerateSitemapFile();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
