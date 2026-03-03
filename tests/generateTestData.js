'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config/config.env') });

const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const User = require('../models/User');
const Massage = require('../models/Massage');
const Reservation = require('../models/Reservation');

// ─── Configuration ────────────────────────────────────────────────────────────
// Edit these defaults, or override via CLI flags (see bottom of this file).
const CONFIG = {
    users: {
        count: 10,              // number of regular users to create
        adminCount: 2,          // number of admin users to create
        password: 'password' // shared password for every generated user
    },
    massages: {
        count: 5                // number of massage shops to create
    },
    reservations: {
        count: 20,              // number of reservations to create
        daysAhead: 30,          // max days from today for a reserveDate
        daysBack: 10,           // max days before today for a reserveDate
        ratedRatio: 0.6         // fraction of reservations that are pre-rated (0–1)
    },
    clearExisting: true         // drop all documents before inserting new ones
};

// ─── CLI Overrides ────────────────────────────────────────────────────────────
// Usage:
//   node tests/generateTestData.js
//   node tests/generateTestData.js --users=20 --admins=3 --massages=8 --reservations=50 --clear=false
process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    switch (key) {
        case 'users': CONFIG.users.count = parseInt(value); break;
        case 'admins': CONFIG.users.adminCount = parseInt(value); break;
        case 'massages': CONFIG.massages.count = parseInt(value); break;
        case 'reservations': CONFIG.reservations.count = parseInt(value); break;
        case 'clear': CONFIG.clearExisting = value !== 'false'; break;
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Random element from an array */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** Tel in the format required by UserSchema: xxx-xxx-xxxx */
const generateTel = () =>
    `${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(4)}`;

/** 5-digit Thai postal code */
const generatePostalCode = () => faker.string.numeric(5);

const THAI_PROVINCES = [
    'Bangkok', 'Chiang Mai', 'Phuket', 'Krabi', 'Koh Samui',
    'Pattaya', 'Hua Hin', 'Ayutthaya', 'Chiang Rai', 'Khon Kaen',
    'Nakhon Ratchasima', 'Udon Thani', 'Nonthaburi', 'Pathum Thani', 'Songkhla'
];

const THAI_DISTRICTS = [
    'Sukhumvit', 'Silom', 'Siam', 'Rattanakosin', 'Chatuchak',
    'Nimmanhaemin', 'Old City', 'Patong', 'Ao Nang', 'Chaweng',
    'Na Jomtien', 'Cha-am', 'Bang Rak', 'Lat Phrao', 'Huai Khwang'
];

// ─── Data Generators ──────────────────────────────────────────────────────────

/**
 * Build an array of plain user objects (password pre-hashed so we can use
 * insertMany, bypassing the Mongoose pre-save hook for speed).
 */
async function buildUsers(count, role) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(CONFIG.users.password, salt);

    return Array.from({ length: count }, (_, i) => ({
        name: faker.person.fullName(),
        tel: generateTel(),
        // First admin / first regular user always uses a fixed, predictable email
        email: (role === 'admin' && i === 0)
            ? 'admin@example.com'
            : (role === 'user' && i === 0)
            ? 'user@example.com'
            : faker.internet.email({ provider: 'example.com' }).toLowerCase(),
        password: hashedPassword,
        role
    }));
}

/** Build an array of massage-shop objects. Names are guaranteed unique. */
function buildMassages(count) {
    const usedNames = new Set();
    return Array.from({ length: count }, () => {
        let name;
        do {
            name = `${faker.company.name()} Massage & Spa`;
        } while (usedNames.has(name));
        usedNames.add(name);

        const picCount = faker.number.int({ min: 1, max: 3 });
        const pictures = Array.from({ length: picCount }, (_, i) =>
            `https://picsum.photos/seed/${encodeURIComponent(name)}-${i}/600/400`
        );
        return {
            name,
            address: faker.location.streetAddress(),
            district: pick(THAI_DISTRICTS),
            province: pick(THAI_PROVINCES),
            postalcode: generatePostalCode(),
            tel: generateTel(),
            price: faker.number.int({ min: 200, max: 3000 }),
            pictures,
            ratingSum: 0,
            userRatingCount: 0,
            averageRating: 0
        };
    });
}

/** Build an array of reservation objects referencing inserted users & massages.
 *  A random subset (ratedRatio) will be pre-rated with a random integer 1–5.
 */
function buildReservations(users, massages, count) {
    const now = new Date();
    const { daysAhead, daysBack, ratedRatio } = CONFIG.reservations;

    return Array.from({ length: count }, () => {
        const offsetDays = faker.number.int({ min: -daysBack, max: daysAhead });
        const reserveDate = new Date(now);
        reserveDate.setDate(reserveDate.getDate() + offsetDays);

        const isRated = Math.random() < ratedRatio;
        const rating = isRated ? faker.number.int({ min: 1, max: 5 }) : undefined;

        return {
            reserveDate,
            user: pick(users)._id,
            massage: pick(massages)._id,
            ...(isRated && { rating, isRated: true })
        };
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Connecting to database...');
    await connectDB();

    if (CONFIG.clearExisting) {
        console.log('Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Massage.deleteMany({}),
            Reservation.deleteMany({})
        ]);
        console.log('Existing data cleared.\n');
    }

    // ── Users ──────────────────────────────────────────────────────────────
    const { count: userCount, adminCount } = CONFIG.users;
    console.log(`Generating ${userCount} regular users and ${adminCount} admins...`);

    const [regularUserDocs, adminUserDocs] = await Promise.all([
        buildUsers(userCount, 'user'),
        buildUsers(adminCount, 'admin')
    ]);

    const insertedUsers = await User.insertMany(
        [...regularUserDocs, ...adminUserDocs],
        { ordered: false }
    );
    console.log(`  Inserted ${insertedUsers.length} users`);

    // ── Massage shops ──────────────────────────────────────────────────────
    console.log(`\nGenerating ${CONFIG.massages.count} massage shops...`);

    const massageDocs = buildMassages(CONFIG.massages.count);
    const insertedMassages = await Massage.insertMany(massageDocs, { ordered: false });
    console.log(`  Inserted ${insertedMassages.length} massage shops`);

    // ── Reservations ───────────────────────────────────────────────────────
    console.log(`\nGenerating ${CONFIG.reservations.count} reservations...`);

    const reservationDocs = buildReservations(
        insertedUsers,
        insertedMassages,
        CONFIG.reservations.count
    );
    const insertedReservations = await Reservation.insertMany(reservationDocs);
    const ratedCount = reservationDocs.filter(r => r.isRated).length;
    console.log(`  Inserted ${insertedReservations.length} reservations (${ratedCount} pre-rated)`);

    // ── Back-fill massage rating stats ─────────────────────────────────────
    console.log('\nBack-filling massage rating stats...');

    // Aggregate per-massage rating totals from the reservation docs
    const ratingMap = {};
    reservationDocs.forEach(r => {
        if (!r.isRated) return;
        const id = r.massage.toString();
        if (!ratingMap[id]) ratingMap[id] = { sum: 0, count: 0 };
        ratingMap[id].sum += r.rating;
        ratingMap[id].count += 1;
    });

    await Promise.all(
        Object.entries(ratingMap).map(([massageId, { sum, count }]) =>
            Massage.findByIdAndUpdate(massageId, {
                ratingSum: sum,
                userRatingCount: count,
                averageRating: sum / count
            })
        )
    );
    console.log(`  Updated rating stats for ${Object.keys(ratingMap).length} massage shop(s)`);

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────');
    console.log('Test data generation complete!');
    console.log(`  Users        : ${insertedUsers.length} (${userCount} regular + ${adminCount} admin)`);
    console.log(`  Massage shops: ${insertedMassages.length}`);
    console.log(`  Reservations : ${insertedReservations.length} (${ratedCount} pre-rated, ${insertedReservations.length - ratedCount} unrated)`);
    console.log(`  Password     : "${CONFIG.users.password}" (all generated users)`);
    console.log(`  Fixed emails : admin@example.com (admin) | user@example.com (user)`);
    console.log('─────────────────────────────────────────');

    process.exit(0);
}

main().catch(err => {
    console.error('\nFailed to generate test data:', err.message);
    process.exit(1);
});
