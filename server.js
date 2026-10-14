const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { requireLogin, requireRole } = require('./middleware/auth');

const app = express();
const db = new sqlite3.Database('./database.sqlite');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'chi-cong-computer-secret-key-2026',
    resave: false,
    saveUninitialized: false
}));

// --- KHỞI TẠO CƠ SỞ DỮ LIỆU & TÀI KHOẢN MẪU ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        type_condition TEXT,
        serial_number TEXT UNIQUE,
        distributor TEXT,
        warranty_npp TEXT,
        retail_price REAL,
        tech_price REAL,
        stock INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS repairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_name TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        issue_status TEXT,
        repair_status TEXT DEFAULT 'pending',
        price REAL DEFAULT 0,
        payment_method TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_type TEXT,
        file_name TEXT,
        supplier_customer_name TEXT,
        total_amount REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tạo tài khoản mẫu (Mật khẩu chung cho tất cả là: 123456)
    const hash = bcrypt.hashSync('123456', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', '${hash}', 'manager')`);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('staff', '${hash}', 'staff')`);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('customer', '${hash}', 'customer')`);
});

// --- ROUTES: AUTHENTICATION ---
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.render('login', { error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
        }
        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.redirect('/');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- 1. CUSTOMER ROUTES (Trang chủ & Chi tiết sản phẩm) ---
app.get('/', (req, res) => {
    db.all(`SELECT * FROM products`, [], (err, products) => {
        res.render('index', { user: req.session.user, products: products || [] });
    });
});

// --- 2. STAFF ROUTES (Nhận/trả máy, Kho sản phẩm, Tra cứu SĐT) ---
app.get('/staff', requireRole('staff'), (req, res) => {
    db.all(`SELECT * FROM repairs ORDER BY id DESC`, [], (err, repairs) => {
        db.all(`SELECT * FROM products`, [], (err2, products) => {
            res.render('staff', { user: req.session.user, repairs: repairs || [], products: products || [] });
        });
    });
});

app.post('/staff/repair/add', requireRole('staff'), (req, res) => {
    const { machine_name, customer_name, customer_phone, issue_status } = req.body;
    db.run(`INSERT INTO repairs (machine_name, customer_name, customer_phone, issue_status) VALUES (?, ?, ?, ?)`,
        [machine_name, customer_name, customer_phone, issue_status], () => {
            res.redirect('/staff');
        });
});

app.post('/staff/repair/return/:id', requireRole('staff'), (req, res) => {
    const { price, payment_method } = req.body;
    const repairId = req.params.id;
    db.run(`UPDATE repairs SET repair_status = 'done', price = ?, payment_method = ? WHERE id = ?`,
        [price, payment_method, repairId], () => {
            res.redirect('/staff');
        });
});

app.get('/staff/history', requireRole('staff'), (req, res) => {
    const phone = req.query.phone || '';
    if (!phone) return res.render('history', { user: req.session.user, repairs: [], phone: '' });
    db.all(`SELECT * FROM repairs WHERE customer_phone = ?`, [phone], (err, repairs) => {
        res.render('history', { user: req.session.user, repairs: repairs || [], phone });
    });
});

// --- 3. MANAGER ROUTES (Hóa đơn VAT, Kho, Dashboard) ---
app.get('/manager', requireRole('manager'), (req, res) => {
    db.all(`SELECT * FROM invoices ORDER BY id DESC`, [], (err, invoices) => {
        db.all(`SELECT SUM(total_amount) as total_in FROM invoices WHERE invoice_type = 'IN'`, [], (err2, rowIn) => {
            db.all(`SELECT SUM(total_amount) as total_out FROM invoices WHERE invoice_type = 'OUT'`, [], (err3, rowOut) => {
                res.render('manager', {
                    user: req.session.user,
                    invoices: invoices || [],
                    totalIn: rowIn[0]?.total_in || 0,
                    totalOut: rowOut[0]?.total_out || 0
                });
            });
        });
    });
});

app.post('/manager/invoice/add', requireRole('manager'), (req, res) => {
    const { invoice_type, file_name, supplier_customer_name, total_amount } = req.body;
    db.run(`INSERT INTO invoices (invoice_type, file_name, supplier_customer_name, total_amount) VALUES (?, ?, ?, ?)`,
        [invoice_type, file_name, supplier_customer_name, total_amount], () => {
            res.redirect('/manager');
        });
});

app.listen(3000, () => console.log('Server Chí Công Computer đang chạy tại http://localhost:3000'));