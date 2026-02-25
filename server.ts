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
addColumn('articles', 'is_pinned', "INTEGER DEFAULT 0");
addColumn('articles', 'source_type', "TEXT");
addColumn('articles', 'source_url', "TEXT");
addColumn('comments', 'parent_id', "INTEGER REFERENCES comments(id) ON DELETE CASCADE");
addColumn('notifications', 'payload', "TEXT");
addColumn('users', 'created_at', "DATETIME");

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
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Ошибка при обновлении статьи" });
    }
  });

  app.delete("/api/admin/articles/:id", isAdmin, (req, res) => {
    db.prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
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
  });

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
    const products = db.prepare("SELECT * FROM products ORDER BY is_pinned DESC, created_at DESC").all();
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
    const { name, description, price, image, category, delivery_content, tags } = req.body;
    try {
      const info = db.prepare("INSERT INTO products (name, description, price, image, category, delivery_content, tags) VALUES (?, ?, ?, ?, ?, ?, ?)").run(name, description, price, image, category || 'Общее', delivery_content || null, tags || null);
      res.json({ id: info.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: "Ошибка при создании товара" });
    }
  });

  app.put("/api/admin/products/:id", isAdmin, (req, res) => {
    const { name, description, price, image, category, delivery_content, tags, is_pinned } = req.body;
    try {
      db.prepare("UPDATE products SET name = ?, description = ?, price = ?, image = ?, category = ?, delivery_content = ?, tags = ?, is_pinned = ? WHERE id = ?").run(name, description, price, image, category || 'Общее', delivery_content || null, tags || null, is_pinned ? 1 : 0, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: "Ошибка при обновлении товара" });
    }
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
    const { amount, paymentMethod } = req.body;
    const amt = parseInt(amount);
    if (!amount || amt < minTopUp) {
      return res.status(400).json({ error: `Минимальная сумма пополнения — ${minTopUp} ₽` });
    }
    const methodKey = typeof paymentMethod === "string" ? paymentMethod.toLowerCase() : "sbp";
    const plategaMethod = paymentMethodMap[methodKey] ?? 2;
    if (!cfg.merchant || !cfg.secret) {
      return res.status(503).json({ error: "Платёжная система не настроена. Заполните Merchant ID и Secret в разделе PLATEGA." });
    }
    const plategaHeaders = { "Content-Type": "application/json", "X-MerchantId": cfg.merchant, "X-Secret": cfg.secret };
    try {
      const returnUrl = `${SITE_URL}/topup/success`;
      const failedUrl = `${SITE_URL}/topup?failed=1`;
      const plategaRes = await fetch(`${cfg.base}/transaction/process`, {
        method: "POST",
        headers: plategaHeaders,
        body: JSON.stringify({
          paymentMethod: plategaMethod,
          paymentDetails: { amount: amt, currency: "RUB" },
          description: `Пополнение баланса BossExam — ${amt} ₽`,
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
        "INSERT INTO payment_pending (user_id, amount_rub, platega_transaction_id, status) VALUES (?, ?, ?, 'PENDING')"
      ).run(req.user.id, amt, transactionId);
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
        db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(row.amount_rub, row.user_id);
        db.prepare("UPDATE payment_pending SET status = 'CONFIRMED' WHERE id = ?").run(row.id);
        const u = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(row.user_id) as { username: string; display_name: string };
        const name = u?.display_name || u?.username || "Пользователь";
        createNotificationForAdmins("topup", "Пополнение баланса", `${name} пополнил баланс на ${row.amount_rub} ₽ (оплата)`, "/admin");
      }
    } catch (err: any) {
      console.error("Payment webhook error:", err);
    }
    res.status(200).send("OK");
  });

  app.get("/api/payment/check-return", isAdmin, async (req: any, res) => {
    const row = db.prepare("SELECT platega_transaction_id FROM payment_pending WHERE user_id = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1").get(req.user.id) as { platega_transaction_id: string } | undefined;
    const transactionId = row?.platega_transaction_id;
    if (!transactionId) {
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
        const row = db.prepare("SELECT * FROM payment_pending WHERE platega_transaction_id = ? AND status = 'PENDING'").get(transactionId) as any;
        if (row) {
          db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(row.amount_rub, row.user_id);
          db.prepare("UPDATE payment_pending SET status = 'CONFIRMED' WHERE id = ?").run(row.id);
          const u = db.prepare("SELECT username, display_name FROM users WHERE id = ?").get(row.user_id) as { username: string; display_name: string };
          const name = u?.display_name || u?.username || "Пользователь";
          createNotificationForAdmins("topup", "Пополнение баланса", `${name} пополнил баланс на ${row.amount_rub} ₽ (оплата)`, "/admin");
          if (req.user && req.user.id === row.user_id) {
            const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(row.user_id) as any;
            req.user.balance = user.balance;
          }
        }
        // транзакция обработана в БД
        return res.json({ status: "CONFIRMED", credited: true });
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
