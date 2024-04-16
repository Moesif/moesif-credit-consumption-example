const express = require('express');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_API_KEY);

const MOESIF_MANAGEMENT_TOKEN = process.env.MOESIF_MANAGEMENT_TOKEN;
const app = express();
app.use(express.json());

app.post(`/top-up`, async (req, res) => {
    const { amount, customer_id } = req.body;

    const paymentMethods = await stripe.paymentMethods.list({
        customer: customer_id,
        type: 'card',
        limit: 1
      });
  
    console.log(paymentMethods);
    if(paymentMethods.data.length === 0) {
        return res.status(400).json({ error: 'No payment method found for this customer. The customer needs to have a payment method added to their Stripe account.' });
    }

    const paymentID = paymentMethods.data[0].id; 

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        customer: customer_id,
        payment_method: paymentID,
        off_session: true,
        payment_method_types: ['card'],
        confirm: true,
        error_on_requires_action: true,
    });

    const subscriptions = await stripe.subscriptions.list({
        customer: customer_id,
    });

    const subscriptionId = subscriptions.data[0].id;
    console.log(subscriptionId);

    const url = `${process.env.MOESIF_API_URL}`;
    const transactionType = "credit";
    const transactionAmount= amount;

    const body = {
        "company_id": customer_id,
        "amount": transactionAmount,
        "type": transactionType,
        "subscription_id": subscriptionId,
        "transaction_id": uuidv4().toString(),
        "description": "top up from API, post Stripe top-up event"
    };

    console.log('Creating balance transaction:', body);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': MOESIF_MANAGEMENT_TOKEN
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            console.log('Balance transaction created successfully');
        } else {
            console.error('Failed to create balance transaction!', response.status, response.statusText, await response.json());
        }
    } catch (error) {
        console.error('An error occurred while creating balance transaction:', error);
    }

    res.json({ client_secret: paymentIntent.client_secret });
});

app.listen(4242, () => console.log('Running on port 4242'));