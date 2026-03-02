const Reservation = require('../models/Reservation');
const Massage = require('../models/Massage');

//@desc     Get all reservations
//@route    GET /api/reservations
//@access   Private
exports.getReservations = async (req, res, next) =>{
    let query;

    if(req.user.role !== 'admin'){
        query = Reservation.find({user: req.user.id}).populate({
            path: 'massage',
            select: 'name province tel'
        });
    }
    else{
        if(req.params.massageId){
            console.log(req.params.massageId);

            query = Reservation.find({massage: req.params.massageId}).populate({
                path: 'massage',
                select: 'name province tel'
            });
        }
        else{
            query = Reservation.find().populate({
                path: 'massage',
                select: 'name province tel'
            });
        }
    }

    try {
        const reservations = await query;

        res.status(200).json({success: true, count: reservations.length, data: reservations});
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot find Reservation"});
    }
};

//@desc     Get single reservation
//@route    GET /api/reservations/:id
//@access   Private
exports.getReservation = async (req, res, next) =>{
    try {
        const reservation = await Reservation.findById(req.params.id).populate({
            path: 'massage',
            select: 'name decription tel'
        });

        if(!reservation){
            return res.status(400).json({success: false, message: `No reservation with the id of ${req.params.id}`});
        }

        res.status(200).json({success: true, data: reservation});
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot find Reservation"});
    }
};

//@desc     Add reservation
//@route    POST /api/reservations
//@access   Private
exports.addReservation = async (req, res, next) =>{
    try {
        req.body.massage = req.params.massageId;

        const massage = await Massage.findById(req.params.massageId);

        if(!massage){
            return res.status(400).json({success: false, message: `No Massage with the id of ${req.params.massageId}`});
        }

        //add user Id to req.body
        req.body.user = req.user.id;
        const existReservations = await Reservation.find({user: req.user.id});

        if(existReservations.length >= 3 && req.user.role !== 'admin'){
            return res.status(400).json({success: false, message: `The user with ID ${req.user.id} has already made 3 reservations`});
        }

        const reservation = await Reservation.create(req.body);
        res.status(200).json({success: true, data: reservation});
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot create Reservations"});
    }
};

//@desc     Update reservation
//@route    PUT /api/reservations/:id
//@access   Private
exports.updateReservation = async (req, res, next) =>{
    try {
        let reservation = await Reservation.findById(req.params.id);

        if(!reservation){
            return res.status(404).json({success: false, message: `No reservation with the id of ${req.params.id}`});
        }

        //Make sure user id the reservation owner
        if(reservation.user.toString() !== req.user.id && req.user.role !== 'admin'){
            return res.status(401).json({success: false, message: `User ${req.user.id} is not authorized this appointment`});
        }

        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({success: true, data: reservation});
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot update Reservation"});
    }
};

//@desc     Delete reservation
//@route    DELETE /api/reservations/:id
//@access   Private
exports.deleteReservation = async (req, res, next) =>{
    try {
        const reservation = await Reservation.findById(req.params.id);

        if(!reservation){
            return res.status(404).json({success: false, message: `No reservation with the id of ${req.params.id}`});
        }

        //Make sure user id the reservation owner
        if(reservation.user.toString() !== req.user.id && req.user.role !== 'admin'){
            return res.status(401).json({success: false, message: `User ${req.user.id} is not authorized this appointment`});
        }

        await reservation.deleteOne();
        res.status(200).json({success: true, data: {}});
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot delete Reservation"});
    }
};

//@desc     Rate a reservation
//@route    PATCH /api/reservations/:id/rate
//@access   Private (owner only)
exports.rateReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
        }

        // Only the reservation owner can rate
        if (reservation.user.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to rate this reservation` });
        }

        // Prevent double-rating
        if (reservation.isRated) {
            return res.status(400).json({ success: false, message: 'You have already rated this reservation' });
        }

        const { rating } = req.body;

        if (!rating || !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
            return res.status(400).json({ success: false, message: 'Please provide a whole number rating between 1 and 5' });
        }

        const intRating = Number(rating);

        // Update the reservation
        reservation.rating = intRating;
        reservation.isRated = true;
        await reservation.save();

        // Update the massage shop's rating stats
        const massage = await Massage.findById(reservation.Massage);
        if (massage) {
            massage.ratingSum += intRating;
            massage.userRatingCount += 1;
            massage.averageRating = massage.ratingSum / massage.userRatingCount;
            await massage.save();
        }

        res.status(200).json({ success: true, data: reservation });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Cannot rate reservation' });
    }
};