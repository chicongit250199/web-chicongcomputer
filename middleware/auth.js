// Kiểm tra đăng nhập
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

// Kiểm tra quyền hạn theo vai trò (role)
function requireRole(role) {
    return (req, res, next) => {
        if (!req.session.user || req.session.user.role !== role) {
            return res.status(403).send("403 Forbidden: Tài khoản của anh không có quyền truy cập chức năng này!");
        }
        next();
    };
}

module.exports = { requireLogin, requireRole };