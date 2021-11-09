const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
require("dotenv").config();
const admin = require("firebase-admin");
const { MongoClient } = require("mongodb");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2r10p.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);

      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentCollection = database.collection("appointments");
    const userCollection = database.collection("users");

    app.get("/appointments", async (req, res) => {
      const query = req.query;
      const cursor = appointmentCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment);
      res.json(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;

      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };

          const updateDoc = { $set: { role: "admin" } };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res.status(403).json({ message: "Sorry! You are not an admin." });
      }
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running Doctors Portal Server");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

/* 
app.get('/users') --> get all users...
app.post('/users') --> insert only one
app.get('/users/:id') --> get only one
app.put('/users/:id') --> update only one
app.delete('/users/:id') --> delete only one
 */
