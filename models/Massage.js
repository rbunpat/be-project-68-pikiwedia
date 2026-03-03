const mongoose = require('mongoose');

const MassageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name can not be more than 50 characters']
    },
    address: {
        type: String,
        required: [true, 'Please add an address']
    },
    district: {
        type: String,
        required: [true, 'Please add a district']
    },
    province: {
        type: String,
        required: [true, 'Please add a province']
    },
    postalcode: {
        type: String,
        required: [true, 'Please add a postalcode'],
        maxlength: [5, 'Postal code can not be more than 5 digits']
    },
    tel: {
        type: String,
        required: [true, 'Please add a telephone number']
    },
    pictures: {
        type: [String],
        default: []
    },
    price: {
        type: Number,
        required: [true, 'Please add a starting price']
    },
    ratingSum: {
        type: Number,
        default: 0
    },
    userRatingCount: {
        type: Number,
        default: 0
    },
    averageRating: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    // ต้องเปิดการใช้งาน Virtuals เพื่อให้ดึงข้อมูลข้าม Collection (ตาราง) ได้
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});



// Reverse populate with virtuals: สร้างฟิลด์จำลองชื่อ 'reservations' 
// เพื่อดึงข้อมูลจากตาราง Reservation มาโชว์ในร้านนวด
MassageSchema.virtual('reservations', {
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'massage', // ต้องตรงกับชื่อฟิลด์ใน models/Reservation.js ที่เก็บ ID ของร้านนวด
    justOne: false
});

// Cascade delete: ถ้าลบร้านนวด (Massage) ให้ลบการจอง (Reservation) ที่ผูกกับร้านนี้ทิ้งให้หมด
MassageSchema.pre('deleteOne', { document: true, query: false }, async function () {
    console.log(`Reservations being removed from massage shop ${this._id}`);
    await this.model('Reservation').deleteMany({ massage: this._id });
});

module.exports = mongoose.model('Massage', MassageSchema);
