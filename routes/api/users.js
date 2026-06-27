const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');

// Public routes
router.post('/login', userController.login);
router.post('/logout', userController.logout);

// Protected routes
router.use(userController.authenticate);

// User routes (accessible by authenticated users)
router.get('/profile', (req, res) => {
  res.json(req.user);
});

// Admin routes
router.use(userController.authorizeAdmin);
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;