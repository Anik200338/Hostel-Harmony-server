const express = require('express');
const jwt = require('jsonwebtoken');
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
      'https://assignment-12-2d5b0.web.app',
      'https://assignment-12-2d5b0.firebaseapp.com',
    ],
  })
);
app.use(express.json());
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

    mealsCollection
      .createIndex({ title: 1, category: 1, email: 1 })
      .then(() => console.log('Index created on name field'))
      .catch(err => console.error('Failed to create index:', err));

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '7d',
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    // meal Api
    app.get('/meal', async (req, res) => {
      const { search, category, minPrice, maxPrice } = req.query;

      // Construct the query object based on the search parameter
      const query = {};

      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }

      if (category) {
        switch (category) {
          case 'breakfast':
            query.category = 'Breakfast';
            break;
          case 'lunch':
            query.category = 'Lunch';
            break;
          case 'dinner':
            query.category = 'Dinner';
            break;
          default:
            break;
        }
      }

      if (minPrice) {
        query.price = { ...query.price, $gte: parseFloat(minPrice) };
      }

      if (maxPrice) {
        query.price = { ...query.price, $lte: parseFloat(maxPrice) };
      }

      try {
        // Fetch meals from the database using the constructed query
        const result = await mealsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching meals:', error);
        res.status(500).send('Error fetching meals');
      }
    });
    app.get('/mealTab', async (req, res) => {
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });

    app.post('/AddMeal', verifyToken, verifyAdmin, async (req, res) => {
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
    app.get('/AllReview', verifyToken, verifyAdmin, async (req, res) => {
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
    app.get('/MyReviewForMe/:email', verifyToken, async (req, res) => {
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
    // Upcoming meal api
    app.get('/UpcomingMeal', async (req, res) => {
      try {
        const result = await upComingMealsCollection
          .find()
          .sort({ like: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching upcoming meals:', error);
        res.status(500).send({ message: 'Failed to fetch upcoming meals' });
      }
    });
    app.post('/AddUpcomingMeal', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await upComingMealsCollection.insertOne(item);
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

    //  request meal
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

    app.get('/ServeMeals', verifyToken, verifyAdmin, async (req, res) => {
      const { search } = req.query;
      const query = {};

      if (search) {
        query.$or = [
          { 'User.email': { $regex: search, $options: 'i' } },
          { 'User.Name': { $regex: search, $options: 'i' } },
        ];
      }

      try {
        const result = await mealRequestsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching ServeMeals:', error);
        res
          .status(500)
          .json({ error: 'An error occurred while fetching ServeMeals' });
      }
    });

    app.get('/singlereq/:id', async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection
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

    app.get('/Requested/:email', verifyToken, async (req, res) => {
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
    // user api
    app.post('/user', async (req, res) => {
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
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const { search } = req.query;
      const query = {};

      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ];
      }

      try {
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching users:', error);
        res
          .status(500)
          .json({ error: 'An error occurred while fetching users' });
      }
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    app.patch(
      '/users/admin/:id',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: 'admin',
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );
    // package
    app.get('/packages', async (req, res) => {
      const result = await packagesCollection.find().toArray();
      res.send(result);
    });
    app.get('/singlePack/:package', async (req, res) => {
      const query = { name: req.params.package };
      const result = await packagesCollection.findOne(query);
      console.log(result);
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
          case 'gold':
            badge = 'gold-badge';
            break;
          case 'silver':
            badge = 'silver-badge';
            break;
          case 'platinum':
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
    // UpComing like api
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
      const updatedMeal = await upComingMealsCollection.findOneAndUpdate(
        query,
        update,
        { returnDocument: 'after' }
      );

      if (updatedMeal.like >= 10) {
        const newMeal = {
          title: updatedMeal.title,
          category: updatedMeal.category,
          image: updatedMeal.image,
          ingredients: updatedMeal.ingredients,
          description: updatedMeal.description,
          price: updatedMeal.price,
          rating: updatedMeal.rating,
          postTime: new Date().toLocaleString(),
          like: 0, // reset likes
          review: 0, // reset reviews
          cartId: updatedMeal._id.toString(),
          admin: {
            name: updatedMeal.admin.name,
            image: updatedMeal.admin.image,
            email: updatedMeal.admin.email,
          },
        };
        delete newMeal._id;

        const result = await mealsCollection.insertOne(newMeal);
        await upComingMealsCollection.deleteOne(query);

        return res.send({ message: 'Meal added to the regular menu', result });
      }

      res.send(updatedMeal);
    });
    app.get('/AllMeals', verifyToken, verifyAdmin, async (req, res) => {
      const sortField = req.query.sortBy || 'like';
      const sortOrder = req.query.order === 'desc' ? -1 : 1;

      try {
        const result = await mealsCollection
          .find()
          .sort({ [sortField]: sortOrder })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch meals' });
      }
    });

    app.delete('/myDeleteMeal/:id', async (req, res) => {
      try {
        const mealId = req.params.id;
        const mealObjectId = new ObjectId(mealId);

        // Delete the meal from the mealsCollection
        const mealDeleteResult = await mealsCollection.deleteOne({
          _id: mealObjectId,
        });

        // Delete the corresponding requests from the mealRequestsCollection
        const requestDeleteResult = await mealRequestsCollection.deleteMany({
          id: mealId,
        });

        // Delete the corresponding reviews from the reviewsCollection
        const reviewsDeleteResult = await AddReview.deleteMany({
          id: mealId,
        });

        console.log('Meal Delete Result:', mealDeleteResult);
        console.log('Request Delete Result:', requestDeleteResult);
        console.log('Reviews Delete Result:', reviewsDeleteResult);

        res.send({
          mealDeleteResult,
          requestDeleteResult,
          reviewsDeleteResult,
          acknowledged:
            mealDeleteResult.acknowledged &&
            requestDeleteResult.acknowledged &&
            reviewsDeleteResult.acknowledged,
          deletedCount:
            mealDeleteResult.deletedCount +
            requestDeleteResult.deletedCount +
            reviewsDeleteResult.deletedCount,
        });
      } catch (error) {
        console.error('Error deleting meal, requests, and reviews:', error);
        res.status(500).send({
          error:
            'An error occurred while deleting the meal, requests, and reviews',
        });
      }
    });

    app.get('/UpdateDetailsMeal/:id', async (req, res) => {
      const result = await mealsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    app.put('/updateMeal/:id', async (req, res) => {
      console.log(req.params.id);
      const query = { _id: new ObjectId(req.params.id) };
      const data = {
        $set: {
          title: req.body.title,
          category: req.body.category,
          image: req.body.image,
          ingredients: req.body.ingredients,
          description: req.body.description,
          price: req.body.price,
          rating: req.body.rating,
          postTime: req.body.postTime,
          like: req.body.like,
          review: req.body.review,
        },
      };
      const result = await mealsCollection.updateOne(query, data);
      console.log(result);
      res.send(result);
    });

    app.get('/AdminProfile/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    app.get('/paymentHistory/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.get('/mealCount', async (req, res) => {
      const cursor = mealsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
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
