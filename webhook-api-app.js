const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_API_KEY);

const app = express();

app.post(`/top-up`, bodyParser.json(), async (req, res) => {
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

    res.json({ client_secret: paymentIntent.client_secret });
});

app.post('/webhook', bodyParser.raw({type: 'application/json'}), (request, response) => {
    const stripeSignature = request.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, stripeSignature, process.env.STRIPE_ENDPOINT_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'payment_intent.succeeded':
            handleSuccessfulPaymentIntent(event.data);
            break
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    response.json({ received: true });
});

async function handleSuccessfulPaymentIntent(data) {
    const paymentIntent = data.object;
    const customerId = paymentIntent.customer;
    const transactionAmount = paymentIntent.amount_received;  

    const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
    });

    if (subscriptions.data.length === 0) {
        console.error('No subscriptions found for this customer.');
        return;
    }

    const subscriptionId = subscriptions.data[0].id;
    console.log('Subscription ID:', subscriptionId);

    const url = `${process.env.MOESIF_API_URL}`;
    const transactionType = "credit";

    const body = {
        "company_id": customerId,  // Assuming you want the Stripe customer ID here
        "amount": transactionAmount,  // Correct amount from the payment intent
        "type": transactionType,
        "subscription_id": subscriptionId,
        "transaction_id": uuidv4().toString(),
        "description": "Top-up from API, post Stripe top-up event"
    };

    console.log('Creating balance transaction:', body);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MOESIF_MANAGEMENT_TOKEN}`
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
}

app.listen(4242, () => console.log('Running on port 4242'));