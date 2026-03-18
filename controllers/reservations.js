let reservationModel = require('../schemas/reservations');
let inventoryModel = require('../schemas/inventories');
let productModel = require('../schemas/products');

module.exports = {
    // Lấy tất cả reservations của user
    getAllReservationByUser: async function (userId) {
        return await reservationModel
            .find({
                user: userId
            })
            .populate({
                path: 'user',
                select: 'username email'
            })
            .populate({
                path: 'items.product',
                select: 'title price'
            });
    },

    // Lấy một reservation theo ID
    getReservationById: async function (reservationId) {
        return await reservationModel
            .findOne({
                _id: reservationId
            })
            .populate({
                path: 'user',
                select: 'username email'
            })
            .populate({
                path: 'items.product',
                select: 'title price'
            });
    },

    // Reserve từ giỏ hàng
    reserveACart: async function (userId, cartItems, session) {
        let reservationItems = [];
        let totalAmount = 0;

        // Kiểm tra và tính amount từ giỏ hàng
        for (let cartItem of cartItems) {
            let product = await productModel.findById(cartItem.product).session(session);
            if (!product) {
                throw new Error(`Product ${cartItem.product} not found`);
            }

            let inventory = await inventoryModel.findOne({
                product: cartItem.product
            }).session(session);

            if (!inventory || inventory.stock < cartItem.quantity) {
                throw new Error(`Product ${product.title} không đủ hàng trong kho`);
            }

            let subtotal = product.price * cartItem.quantity;
            totalAmount += subtotal;

            reservationItems.push({
                product: cartItem.product,
                quantity: cartItem.quantity,
                title: product.title,
                price: product.price,
                subtotal: subtotal
            });

            // Cập nhật inventory - giảm stock, tăng reserved
            await inventoryModel.updateOne(
                { product: cartItem.product },
                {
                    $inc: {
                        stock: -cartItem.quantity,
                        reserved: cartItem.quantity
                    }
                },
                { session }
            );
        }

        // Tạo reservation
        let expiredIn = new Date();
        expiredIn.setDate(expiredIn.getDate() + 7); // Hạn 7 ngày

        let newReservation = new reservationModel({
            user: userId,
            items: reservationItems,
            amount: totalAmount,
            status: 'actived',
            expiredIn: expiredIn
        });

        await newReservation.save({ session });
        return newReservation;
    },

    // Reserve items cụ thể
    reserveItems: async function (userId, items, session) {
        let reservationItems = [];
        let totalAmount = 0;

        // items có format: [{product: id, quantity: n}, ...]
        for (let item of items) {
            let product = await productModel.findById(item.product).session(session);
            if (!product) {
                throw new Error(`Product ${item.product} not found`);
            }

            let inventory = await inventoryModel.findOne({
                product: item.product
            }).session(session);

            if (!inventory || inventory.stock < item.quantity) {
                throw new Error(`Product ${product.title} không đủ hàng trong kho`);
            }

            let subtotal = product.price * item.quantity;
            totalAmount += subtotal;

            reservationItems.push({
                product: item.product,
                quantity: item.quantity,
                title: product.title,
                price: product.price,
                subtotal: subtotal
            });

            // Cập nhật inventory
            await inventoryModel.updateOne(
                { product: item.product },
                {
                    $inc: {
                        stock: -item.quantity,
                        reserved: item.quantity
                    }
                },
                { session }
            );
        }

        // Tạo reservation
        let expiredIn = new Date();
        expiredIn.setDate(expiredIn.getDate() + 7);

        let newReservation = new reservationModel({
            user: userId,
            items: reservationItems,
            amount: totalAmount,
            status: 'actived',
            expiredIn: expiredIn
        });

        await newReservation.save({ session });
        return newReservation;
    },

    // Hủy reservation
    cancelReservation: async function (reservationId, session) {
        let reservation = await reservationModel.findById(reservationId).session(session);
        
        if (!reservation) {
            throw new Error('Reservation not found');
        }

        if (reservation.status === 'cancelled') {
            throw new Error('Reservation already cancelled');
        }

        // Hoàn lại stock
        for (let item of reservation.items) {
            await inventoryModel.updateOne(
                { product: item.product },
                {
                    $inc: {
                        stock: item.quantity,
                        reserved: -item.quantity
                    }
                },
                { session }
            );
        }

        // Cập nhật status
        reservation.status = 'cancelled';
        await reservation.save({ session });
        return reservation;
    }
};
