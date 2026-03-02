const express = require("express");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { xss } = require("express-xss-sanitizer");

dotenv.config({
    path: "./config/config.env"
});

const limiter = require("./middleware/rateLimiter");
const swaggerSpec = require("./config/swagger");
const connectDB = require("./config/db");

//Route files
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const reservations = require("./routes/reservations");
const massages = require('./routes/massages');
connectDB();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(limiter);
app.use(xss());

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API Server is running"
    });
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/reservations", reservations)
app.use('/api/massages', massages);
// Global 404 and 500 error handlers
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `${req.originalUrl} does not exist`
    });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}, in ${process.env.NODE_ENV} mode.`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});