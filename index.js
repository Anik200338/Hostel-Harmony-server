const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      // 'https://bistro-158cb.web.app',
      // 'https://bistro-158cb.firebaseapp.com',
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

// Food;
// EZievSc9UgqWWiOJ;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.scvnlgi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    const mealsCollection = client.db('FoodDb').collection('meals');
    const upComingMealsCollection = client
      .db('FoodDb')
      .collection('upComingMeals');
    const AddReview = client.db('FoodDb').collection('Review');
    const mealRequestsCollection = client
      .db('FoodDb')
      .collection('mealRequests');
    const userCollection = client.db('FoodDb').collection('users');
    const packagesCollection = client.db('FoodDb').collection(' packages');
    const paymentCollection = client.db('FoodDb').collection('payment');
    // Send a ping to confirm a successful connection

    // meal Api
    app.get('/meal', async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });
    app.post('/AddMeal', async (req, res) => {
      const item = req.body;
      const result = await mealsCollection.insertOne(item);
      res.send(result);
    });
    // singleMeal api
    app.get('/singleMeal/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Food is sitting');
});

app.listen(port, () => {
  console.log(`Food is sitting on port ${port}`);
});
