// backend/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

const app = express();
// Render.com'un vereceği portu veya yerelde 3001'i kullan
const PORT = process.env.PORT || 3001;

// --- İKAS BİLGİLERİN ---
const IKAS_STORE_NAME = 'ikas201';
const CLIENT_ID = '934f561e-8562-47e5-91a0-84e8a94f20e6';
const CLIENT_SECRET = 's_YLVuWzUHlTcLC8QhYpriSRc724f2d20350d74e8e8e81eb22729b2fbb';
const MERCHANT_ID = 'f2d4fb72-0450-4adc-a51a-5f1a120a7976';

const AUTH_URL = `https://${IKAS_STORE_NAME}.myikas.com/api/admin/oauth/token`;
const GRAPHQL_API_URL = 'https://api.myikas.com/api/v1/admin/graphql';

app.use(cors());
let accessToken = null;

const getAccessToken = async () => {
    // Basitlik için token'ı her seferinde alıyoruz. 
    // Daha gelişmiş bir yapıda token'ı süresi dolana kadar saklayabilirsiniz.
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
    });
    const response = await axios.post(AUTH_URL, params);
    return response.data.access_token;
};

const makeGraphQLRequest = async (query, variables) => {
    const token = await getAccessToken();
    const response = await axios.post(GRAPHQL_API_URL, { query, variables }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.data.errors) throw new Error(response.data.errors[0].message);
    return response.data.data;
};

// Test endpointi
app.get('/', (req, res) => {
    res.send('Backend sunucusu çalışıyor!');
});

app.get('/api/customers', async (req, res) => {
    const query = `query($merchantId: StringFilterInput!) { listCustomer(merchantId: $merchantId, pagination: {first: 100}) { data { id, fullName, email, orderCount } } }`;
    try {
        const data = await makeGraphQLRequest(query, { merchantId: { eq: MERCHANT_ID } });
        res.json(data.listCustomer.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/customer/:id/pdf', async (req, res) => {
    const query = `query($merchantId: StringFilterInput!, $customerId: StringFilterInput!) { listCustomer(merchantId: $merchantId, id: $customerId) { data { id, fullName, email, phone, orderCount, totalOrderPrice, addresses { title, addressLine1, city { name }, country { name } } } } }`;
    try {
        const data = await makeGraphQLRequest(query, { merchantId: { eq: MERCHANT_ID }, customerId: { eq: req.params.id } });
        const customer = data.listCustomer.data[0];
        if (!customer) return res.status(404).send('Müşteri bulunamadı.');

        const doc = new jsPDF();
        doc.text("Müşteri Raporu", 14, 22);
        doc.text(customer.fullName || 'İsimsiz', 14, 32);
        doc.autoTable({
            startY: 40,
            head: [['Alan', 'Değer']],
            body: [
                ["E-posta", customer.email || 'N/A'],
                ["Telefon", customer.phone || 'N/A'],
                ["Sipariş Sayısı", customer.orderCount?.toString() || '0'],
            ],
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="musteri-${customer.id}.pdf"`);
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Sunucu port ${PORT} üzerinde çalışıyor.`));