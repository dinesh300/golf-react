const express = require("express");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", routes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Golf API running on http://localhost:${PORT}`);
});

// in Node API
app.use(cors({ origin: true, credentials: false }));
