var express = require('express');
var router = express.Router();
let userController = require('../controllers/users')
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let { checkLogin } = require('../utils/authHandler')
let crypto = require('crypto')
let { sendMail } = require('../utils/mailHandler')


router.post('/register', async function (req, res, next) {
  let newUser = await userController.CreateAnUser(
    req.body.username,
    req.body.password,
    req.body.email,
    '69a4f929f8d941f2dd234b88'
  )
  res.send(newUser)
});
router.post('/login', async function (req, res, next) {
  let { username, password } = req.body;
  let getUser = await userController.FindByUsername(username);
  if (!getUser) {
    res.status(404).send({
      message: "username khong ton tai hoac thong tin dang nhap sai"
    })
    return;
  }
  let result = bcrypt.compareSync(password, getUser.password);
  if (result) {
    let token = jwt.sign({
      id: getUser._id,
      exp: Date.now() + 3600 * 1000
    }, "HUTECH")
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000
    });
    res.send(token)
  } else {
    res.status(404).send({
      message: "username khong ton tai hoac thong tin dang nhap sai"
    })
  }
});
//localhost:3000
router.get('/me', checkLogin, async function (req, res, next) {
  let user = await userController.FindByID(req.userId);
  res.send(user)
});
router.post('/logout', checkLogin, function (req, res, next) {
  res.cookie('token', null, {
    maxAge: 0,
    httpOnly: true
  })
  res.send("logout")
})
// Thay đổi password (cần đăng nhập)
router.post('/changepassword', checkLogin, async function (req, res, next) {
  try {
    let { oldPassword, newPassword } = req.body;
    
    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).send({
        success: false,
        message: "Old password và new password là bắt buộc"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).send({
        success: false,
        message: "Password phải đủ 6 ký tự trở lên"
      });
    }

    if (oldPassword === newPassword) {
      return res.status(400).send({
        success: false,
        message: "Password mới phải khác password cũ"
      });
    }

    let user = await userController.FindByID(req.userId);
    
    // Kiểm tra password cũ
    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(401).send({
        success: false,
        message: "Password cũ không chính xác"
      });
    }

    // Hash password mới
    let hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.send({
      success: true,
      message: "Đã cập nhật password thành công"
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message
    });
  }
});

// Quên password - Gửi email với link reset
router.post('/forgotpassword', async function (req, res, next) {
  try {
    let { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email là bắt buộc"
      });
    }

    let user = await userController.FindByEmail(email);
    
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "Email không tồn tại trong hệ thống"
      });
    }

    // Tạo token hết hạn sau 10 phút
    user.forgotPasswordToken = crypto.randomBytes(31).toString('hex');
    user.forgotPasswordTokenExp = new Date(Date.now() + 10 * 60 * 1000);
    
    await user.save();
    console.log("Reset token:", user.forgotPasswordToken);

    // Gửi email với link reset
    let resetLink = `http://localhost:3000/auth/resetpassword/${user.forgotPasswordToken}`;
    await sendMail(user.email, resetLink);

    res.send({
      success: true,
      message: "Đã gửi email reset password. Vui lòng kiểm tra email của bạn"
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message
    });
  }
});

// Reset password - Sử dụng token từ email
router.post('/resetpassword/:token', async function (req, res, next) {
  try {
    let token = req.params.token;
    let { password } = req.body;

    // Validate input
    if (!password) {
      return res.status(400).send({
        success: false,
        message: "Password mới là bắt buộc"
      });
    }

    if (password.length < 6) {
      return res.status(400).send({
        success: false,
        message: "Password phải đủ 6 ký tự trở lên"
      });
    }

    // Kiểm tra token hợp lệ
    let user = await userController.FindByToken(token);
    
    if (!user) {
      return res.status(400).send({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn"
      });
    }

    // Hash password mới
    let hashedPassword = bcrypt.hashSync(password, 10);
    user.password = hashedPassword;
    user.forgotPasswordToken = '';
    user.forgotPasswordTokenExp = null;
    
    await user.save();

    res.send({
      success: true,
      message: "Đã cập nhật password thành công. Vui lòng đăng nhập lại"
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message
    });
  }
})


module.exports = router;


//mongodb
