// backend/server.js - SADECE VERİ GÖNDEREN FİNAL VERSİYON

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

// Müşterileri listeleyen endpoint
app.get('/api/customers', async (req, res) => {
    try {
        const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
        const authResponse = await axios.post(AUTH_URL, params);
        const accessToken = authResponse.data.access_token;
        const query = `query($merchantId: StringFilterInput!) { listCustomer(merchantId: $merchantId, pagination: {limit: 100}) { data { id, fullName, email, orderCount } } }`;
        const variables = { merchantId: { eq: MERCHANT_ID } };
        const graphqlResponse = await axios.post(GRAPHQL_API_URL, { query, variables }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (graphqlResponse.data.errors) throw new Error(`GraphQL Hatası: ${graphqlResponse.data.errors[0].message}`);
        res.status(200).json(graphqlResponse.data.data.listCustomer.data);
    } catch (error) {
        console.error('!!! /api/customers rotasında hata:', error.message);
        res.status(500).json({ message: 'Müşteri verileri alınamadı.' });
    }
});

// Belirli bir müşterinin detaylı verisini döndüren YENİ endpoint
app.get('/api/customer/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
        const authResponse = await axios.post(AUTH_URL, params);
        const accessToken = authResponse.data.access_token;
        const query = `
          query GetCustomerById($merchantId: StringFilterInput!, $customerId: StringFilterInput!) {
            listCustomer(merchantId: $merchantId, id: $customerId) {
              data { id, fullName, email, phone, orderCount, totalOrderPrice, note, firstOrderDate, lastOrderDate, addresses { title, addressLine1, addressLine2, district { name }, city { name }, country { name } } }
            }
          }
        `;
        const variables = { merchantId: { eq: MERCHANT_ID }, customerId: { eq: id } };
        const graphqlResponse = await axios.post(GRAPHQL_API_URL, { query, variables }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (graphqlResponse.data.errors) throw new Error(`Detay için GraphQL Hatası: ${graphqlResponse.data.errors[0].message}`);
        const customer = graphqlResponse.data.data.listCustomer.data[0];
        if (!customer) return res.status(404).json({ message: 'Müşteri bulunamadı' });
        res.status(200).json(customer);
    } catch (error) {
        console.error(`!!! /api/customer/${id} rotasında hata:`, error.message);
        res.status(500).json({ message: 'Müşteri detayı alınamadı.' });
    }
});

app.listen(PORT, () => console.log(`Sunucu (sadece veri) port ${PORT} üzerinde çalışıyor.`));