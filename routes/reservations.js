var express = require("express");
var router = express.Router();
let mongoose = require('mongoose');
let { checkLogin } = require('../utils/authHandler');
let cartModel = require('../schemas/carts');
let reservationController = require('../controllers/reservations');

// GET /reservations - Lấy tất cả reservations của user
router.get('/', checkLogin, async function (req, res, next) {
    try {
        let result = await reservationController.getAllReservationByUser(req.userId);
        res.send({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
});

// GET /reservations/:id - Lấy một reservation theo ID
router.get('/:id', checkLogin, async function (req, res, next) {
    try {
        let reservation = await reservationController.getReservationById(req.params.id);
        
        if (!reservation) {
            return res.status(404).send({
                success: false,
                message: "Reservation not found"
            });
        }

        if (reservation.user._id.toString() !== req.userId.toString()) {
            return res.status(403).send({
                success: false,
                message: "You don't have permission to view this reservation"
            });
        }

        res.send({
            success: true,
            data: reservation
        });
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message
        });
    }
});

// POST /reserveACart - Reserve từ giỏ hàng
router.post('/reserveACart', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Lấy giỏ hàng của user
        let currentCart = await cartModel.findOne({
            user: req.userId
        }).session(session);

        if (!currentCart || !currentCart.cartItems || currentCart.cartItems.length === 0) {
            await session.abortTransaction();
            return res.status(400).send({
                success: false,
                message: "Cart is empty"
            });
        }

        // Reserve items từ giỏ hàng
        let newReservation = await reservationController.reserveACart(
            req.userId,
            currentCart.cartItems,
            session
        );

        // Xóa items khỏi giỏ hàng sau khi reserve thành công
        currentCart.cartItems = [];
        await currentCart.save({ session });

        await session.commitTransaction();
        
        res.send({
            success: true,
            message: "Reserve cart successfully",
            data: newReservation
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).send({
            success: false,
            message: error.message
        });
    } finally {
        await session.endSession();
    }
});

// POST /reserveItems - Reserve items cụ thể
router.post('/reserveItems', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        let { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            return res.status(400).send({
                success: false,
                message: "Items array is required and must not be empty"
            });
        }

        // Validate items format
        for (let item of items) {
            if (!item.product || !item.quantity || item.quantity < 1) {
                await session.abortTransaction();
                return res.status(400).send({
                    success: false,
                    message: "Each item must have product (ID) and quantity (>= 1)"
                });
            }
        }

        // Reserve items
        let newReservation = await reservationController.reserveItems(
            req.userId,
            items,
            session
        );

        await session.commitTransaction();
        
        res.send({
            success: true,
            message: "Reserve items successfully",
            data: newReservation
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).send({
            success: false,
            message: error.message
        });
    } finally {
        await session.endSession();
    }
});

// POST /cancelReserve/:id - Hủy reservation
router.post('/cancelReserve/:id', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        let reservationId = req.params.id;
        
        // Kiểm tra quyền sở hữu
        let reservation = await reservationController.getReservationById(reservationId);
        
        if (!reservation) {
            await session.abortTransaction();
            return res.status(404).send({
                success: false,
                message: "Reservation not found"
            });
        }

        if (reservation.user._id.toString() !== req.userId.toString()) {
            await session.abortTransaction();
            return res.status(403).send({
                success: false,
                message: "You don't have permission to cancel this reservation"
            });
        }

        // Hủy reservation
        let cancelledReservation = await reservationController.cancelReservation(
            reservationId,
            session
        );

        await session.commitTransaction();
        
        res.send({
            success: true,
            message: "Reservation cancelled successfully",
            data: cancelledReservation
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).send({
            success: false,
            message: error.message
        });
    } finally {
        await session.endSession();
    }
});

module.exports = router;
