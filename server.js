// backend/server.js - SİPARİŞ FORMU İÇİN GÜÇLENDİRİLMİŞ FİNAL VERSİYON

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// --- İKAS BİLGİLERİN ---
const IKAS_STORE_NAME = 'ikas201';
const CLIENT_ID = '934f561e-8562-47e5-91a0-84e8a94f20e6';
const CLIENT_SECRET = 's_YLVuWzUHlTcLC8QhYpriSRc724f2d20350d74e8e8e81eb22729b2fbb';
const MERCHANT_ID = 'f2d4fb72-0450-4adc-a51a-5f1a120a7976';

const AUTH_URL = `https://${IKAS_STORE_NAME}.myikas.com/api/admin/oauth/token`;
const GRAPHQL_API_URL = 'https://api.myikas.com/api/v1/admin/graphql';

app.use(cors({ origin: '*' }));

const executeIkasQuery = async (query, variables) => {
    const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    const authResponse = await axios.post(AUTH_URL, params);
    const accessToken = authResponse.data.access_token;
    const graphqlResponse = await axios.post( GRAPHQL_API_URL, { query, variables }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (graphqlResponse.data.errors) {
        console.error("GraphQL API Hatası:", JSON.stringify(graphqlResponse.data.errors, null, 2));
        throw new Error(`GraphQL Hatası: ${graphqlResponse.data.errors[0].message}`);
    }
    return graphqlResponse.data;
};

// Müşterileri listeler
app.get('/api/customers', async (req, res) => {
    try {
        const query = `query($merchantId: StringFilterInput!) { listCustomer(merchantId: $merchantId, pagination: {limit: 100}) { data { id, fullName, email, orderCount } } }`;
        const variables = { merchantId: { eq: MERCHANT_ID } };
        const data = await executeIkasQuery(query, variables);
        res.status(200).json(data.data.listCustomer.data);
    } catch (error) {
        res.status(500).json({ message: 'Müşteri verileri alınamadı.' });
    }
});

// YENİ: Bir müşteriye ait siparişleri listeler
app.get('/api/orders/customer/:customerId', async (req, res) => {
    const { customerId } = req.params;
    try {
        const query = `
            query($customerId: StringFilterInput!) {
                listOrder(customerId: $customerId, sort: "-orderedAt") {
                    data { id, orderNumber, orderedAt, totalFinalPrice, status }
                }
            }`;
        const variables = { customerId: { eq: customerId } };
        const data = await executeIkasQuery(query, variables);
        res.status(200).json(data.data.listOrder.data);
    } catch (error) {
        res.status(500).json({ message: 'Siparişler alınamadı.' });
    }
});

// YENİ: Tek bir siparişin tüm detaylarını çeker
app.get('/api/order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const query = `
            query($orderId: StringFilterInput!) {
                listOrder(id: $orderId) {
                    data {
                        orderNumber
                        orderedAt
                        totalFinalPrice
                        currencyCode
                        customer { fullName }
                        shippingAddress { firstName, lastName, addressLine1, addressLine2, city { name }, district { name }, phone }
                        paymentMethods { type, price, paymentGatewayName }
                        orderLineItems {
                            quantity
                            finalPrice
                            variant {
                                name
                                brand { name }
                                variantValues { variantTypeName, variantValueName }
                            }
                        }
                    }
                }
            }`;
        const variables = { orderId: { eq: orderId } };
        const data = await executeIkasQuery(query, variables);
        res.status(200).json(data.data.listOrder.data[0]);
    } catch (error) {
        res.status(500).json({ message: 'Sipariş detayı alınamadı.' });
    }
});

app.listen(PORT, () => console.log(`Sunucu (Sipariş Formu) port ${PORT} üzerinde çalışıyor.`));