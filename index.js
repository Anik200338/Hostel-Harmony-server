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
    // Meal like
    app.get('/checkLike/:id/:email', async (req, res) => {
      const { id, email } = req.params;
      try {
        const query = { _id: new ObjectId(id) };
        const meal = await mealsCollection.findOne(query);
        if (meal && meal.likedBy && meal.likedBy.includes(email)) {
          res.json({ hasLiked: true });
        } else {
          res.json({ hasLiked: false });
        }
      } catch (error) {
        console.error('Error checking like status:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    app.post('/likeMeal/:id', async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      const query = { _id: new ObjectId(id) };
      const meal = await mealsCollection.findOne(query);
      if (!meal) {
        return res.status(404).json({ message: 'Meal not found' });
      }
      if (!meal.likedBy) {
        meal.likedBy = [];
      }
      if (meal.likedBy.includes(email)) {
        return res
          .status(400)
          .json({ message: 'User has already liked this meal' });
      }
      const update = { $inc: { like: 1 }, $push: { likedBy: email } };
      const result = await mealsCollection.findOneAndUpdate(query, update, {
        returnDocument: 'after',
      });
      res.send(result.value);
    });

    // meal subscriptionPackage
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      try {
        const user = await userCollection.findOne({ email });
        if (user) {
          res.json({ subscriptionPackage: user.badge }); // Assuming badge holds the subscription package information
        } else {
          res.status(404).json({ message: 'User not found' });
        }
      } catch (error) {
        console.error('Error fetching user subscription:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Review;
    app.post('/addReview/:id', async (req, res) => {
      const review = req.body;
      const mealId = req.params.id;
      console.log('id', mealId);
      const result = await AddReview.insertOne(review);
      const updateDoc = {
        $inc: {
          review: 1,
        },
      };
      const query = { _id: new ObjectId(mealId) };
      const updateReview = await mealsCollection.updateOne(query, updateDoc);
      console.log(updateReview);
      res.send({ result, updateReview });
    });
    app.get('/review/:id', async (req, res) => {
      const result = await AddReview.find({
        id: req.params.id,
      }).toArray();
      res.send(result);
    });
    app.get('/AllReview', async (req, res) => {
      const result = await AddReview.find().toArray();
      res.send(result);
    });
    app.get('/ReviewTitle/:id', async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection
        .find({
          _id: new ObjectId(id),
        })
        .toArray();
      res.send(result);
    });
    app.delete('/myDelete', async (req, res) => {
      const pop = req.query.pop;
      const _id = req.query._id;
      // return console.log(id, id2);
      const result = await AddReview.deleteOne({
        _id: new ObjectId(pop),
      });
      const decreasesDoc = {
        $inc: {
          review: -1,
        },
      };
      const deleteQuery = { _id: new ObjectId(_id) };
      console.log(deleteQuery);
      const decreasesRecommendationCount = await mealsCollection.updateOne(
        deleteQuery,
        decreasesDoc
      );
      res.send(result);
    });
    app.get('/MyReviewForMe/:email', async (req, res) => {
      const email = req.params.email;
      const query = { 'User.email': email };
      const result = await AddReview.find(query).toArray();
      res.send(result);
    });

    app.get('/MyReviewTitleFor/:id', async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection
        .find({
          _id: new ObjectId(id),
        })
        .toArray();
      res.send(result);
    });

    app.get('/UpdateDetails/:id', async (req, res) => {
      const result = await AddReview.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // Upcoming meal api
    app.get('/UpcomingMeal', async (req, res) => {
      const result = await upComingMealsCollection.find().toArray();
      res.send(result);
    });
    app.post('/AddUpcomingMeal', async (req, res) => {
      const item = req.body;
      const result = await upComingMealsCollection.insertOne(item);
      res.send(result);
    });
    app.put('/update/:id', async (req, res) => {
      console.log(req.params.id);
      const query = { _id: new ObjectId(req.params.id) };
      const data = {
        $set: {
          review: req.body.review,
        },
      };
      const result = await AddReview.updateOne(query, data);
      console.log(result);
      res.send(result);
    });
    app.post('/AddMealOfUpComing', async (req, res) => {
      const item = req.body;
      console.log('item', item);
      const result = await mealsCollection.insertOne(item);
      const id = item.cartId;
      const query = { _id: new ObjectId(id) };
      const deleteResult = await upComingMealsCollection.deleteOne(query);
      res.send({ result, deleteResult });
    });

    // Get a single room data from db using _id

    app.post('/requestMeal/:id', async (req, res) => {
      const { User } = req.body;
      const id = req.params.id;
      const request = {
        User,
        id,
        status: 'pending',
        requestedAt: new Date().toLocaleString(),
      };
      const result = await mealRequestsCollection.insertOne(request);
      res.send(result);
    });

    app.get('/ServeMeals', async (req, res) => {
      const result = await mealRequestsCollection.find().toArray();
      res.send(result);
    });
    app.get('/singlereq/:id', async (req, res) => {
      const id = req.params.id;
      const result = await upComingMealsCollection
        .find({
          _id: new ObjectId(id),
        })
        .toArray();
      res.send(result);
    });
    app.post('/updateStatus/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) };
      const update = { $set: { status: status } };
      const result = await mealRequestsCollection.updateOne(query, update);
      res.send(result);
    });

    app.get('/Requested/:email', async (req, res) => {
      const email = req.params.email;
      const query = { 'User.email': email };
      const result = await mealRequestsCollection.find(query).toArray();
      res.send(result);
    });
    app.delete('/myDeleteReq', async (req, res) => {
      const pop = req.query.pop;
      const _id = req.query._id;
      // return console.log(id, id2);
      const result = await mealRequestsCollection.deleteOne({
        _id: new ObjectId(pop),
      });
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists:
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin',
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get('/packages', async (req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result);
    });
    app.get('/singlePack/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await packagesCollection.findOne(query);
      res.send(result);
    });
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const { id } = payment;
      const paymentResult = await paymentCollection.insertOne(payment);

      // Assign badge based on purchased package
      const packageQuery = { _id: new ObjectId(id) };
      const purchasedPackage = await packagesCollection.findOne(packageQuery);

      let badge = '';
      if (purchasedPackage) {
        // Determine badge based on the purchased package
        // Assuming `badge` field exists in the package document
        switch (purchasedPackage.name) {
          case 'Gold':
            badge = 'gold-badge';
            break;
          case 'Silver':
            badge = 'silver-badge';
            break;
          case 'Platinum':
            badge = 'Platinum-badge';
            break;
          default:
            badge = 'default-badge';
        }
      }

      const userQuery = { email: payment.email };
      const userUpdate = { $set: { badge: badge } };
      await userCollection.updateOne(userQuery, userUpdate);

      res.send({ paymentResult });
    });

    app.get('/checkUpComingLike/:id/:email', async (req, res) => {
      const { id, email } = req.params;
      try {
        const query = { _id: new ObjectId(id) };
        const meal = await upComingMealsCollection.findOne(query);
        if (meal && meal.likedBy && meal.likedBy.includes(email)) {
          res.json({ hasLiked: true });
        } else {
          res.json({ hasLiked: false });
        }
      } catch (error) {
        console.error('Error checking like status:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
    app.post('/likeUpcomingMeal/:id', async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      const query = { _id: new ObjectId(id) };
      const meal = await upComingMealsCollection.findOne(query);
      if (!meal) {
        return res.status(404).json({ message: 'Meal not found' });
      }
      if (!meal.likedBy) {
        meal.likedBy = [];
      }
      if (meal.likedBy.includes(email)) {
        return res
          .status(400)
          .json({ message: 'User has already liked this meal' });
      }
      const update = { $inc: { like: 1 }, $push: { likedBy: email } };
      const result = await upComingMealsCollection.findOneAndUpdate(
        query,
        update,
        { returnDocument: 'after' }
      );
      res.send(result.value);
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
