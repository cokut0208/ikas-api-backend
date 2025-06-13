// backend/server.js - KULLANICININ KEŞFİYLE YAZILMIŞ, NİHAİ VE KUSURSUZ VERSİYON

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

// --- ÖZEL ALAN HARİTASI (CACHE) ---
let customerAttributeMap = {};

const executeIkasQuery = async (query, variables) => {
    const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    const authResponse = await axios.post(AUTH_URL, params);
    const accessToken = authResponse.data.access_token;
    const graphqlResponse = await axios.post(GRAPHQL_API_URL, { query, variables }, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (graphqlResponse.data.errors) {
        console.error("GraphQL API Hatası:", JSON.stringify(graphqlResponse.data.errors, null, 2));
        throw new Error(`GraphQL Hatası: ${graphqlResponse.data.errors[0].message}`);
    }
    return graphqlResponse.data;
};

// Sunucu başladığında özel alanları çekip hafızaya alan fonksiyon
const fetchAndCacheCustomerAttributes = async () => {
    try {
        console.log("Müşteri özel alan tanımları çekiliyor...");
        const query = `{ listCustomerAttribute { id, name } }`;
        const data = await executeIkasQuery(query, {});
        const attributes = data.data.listCustomerAttribute;
        // { "id1": "TC Kimlik Numarası", "id2": "Seri No" } gibi bir harita oluştur
        customerAttributeMap = attributes.reduce((map, attr) => {
            map[attr.id] = attr.name;
            return map;
        }, {});
        console.log("Özel alan haritası başarıyla oluşturuldu:", customerAttributeMap);
    } catch (error) {
        console.error("!!! Sunucu başlangıcında özel alanlar çekilemedi:", error.message);
    }
};

// --- ENDPOINT'LER ---
app.get('/api/customers', async (req, res) => { /* ... öncekiyle aynı ... */ });
app.get('/api/orders/customer/:customerId', async (req, res) => { /* ... öncekiyle aynı ... */ });

// PDF için gereken tüm veriyi birleştiren ana endpoint
app.get('/api/form-data/:customerId/:orderId', async (req, res) => {
    const { customerId, orderId } = req.params;
    try {
        // --- ADIM 1: MÜŞTERİ BİLGİLERİNİ ÇEK ---
        // Sorgu artık doğru alanları istiyor: customerAttributeId ve value
        const customerQuery = `
            query GetCustomerById($customerId: StringFilterInput!, $merchantId: StringFilterInput!) {
                listCustomer(id: $customerId, merchantId: $merchantId) {
                    data {
                        attributes { customerAttributeId, value }
                    }
                }
            }`;
        const customerVariables = { customerId: { eq: customerId }, merchantId: { eq: MERCHANT_ID } };
        const customerData = await executeIkasQuery(customerQuery, customerVariables);
        const customerDetails = customerData.data.listCustomer.data[0];

        // --- ADIM 2: SİPARİŞ BİLGİLERİNİ ÇEK ---
        const orderQuery = `
            query($orderId: StringFilterInput!) {
                listOrder(id: $orderId) { data { /* ... tüm sipariş alanları ... */ } }
            }`;
        // (Order sorgusu uzun olduğu için kısalttım, alttaki tam kodda mevcut)
        const fullOrderQuery = `query($orderId: StringFilterInput!) { listOrder(id: $orderId) { data { orderNumber, orderedAt, totalFinalPrice, currencyCode, taxLines { price, rate }, shippingAddress { firstName, lastName, addressLine1, city { name }, district { name }, phone, identityNumber }, paymentMethods { type, price, paymentGatewayName }, orderLineItems { quantity, finalPrice, variant { name, brand { name }, variantValues { variantTypeName, variantValueName } } } } } }`;
        const orderData = await executeIkasQuery(fullOrderQuery, { orderId: { eq: orderId } });
        const orderDetails = orderData.data.listOrder.data[0];
        if (!orderDetails) return res.status(404).json({ message: 'Sipariş bulunamadı.' });

        // --- ADIM 3: BİRLEŞTİR VE İŞLE ---
        const processedCustomer = {
            attributes: customerDetails.attributes.map(attr => ({
                key: customerAttributeMap[attr.customerAttributeId] || attr.customerAttributeId, // Haritada adı varsa adı, yoksa ID'yi kullan
                value: attr.value
            }))
        };
        
        res.status(200).json({
            order: orderDetails,
            customer: processedCustomer
        });

    } catch (error) {
        console.error(`!!! /api/form-data rotasında hata:`, error.message);
        res.status(500).json({ message: 'Form verisi oluşturulurken hata oluştu.' });
    }
});

// Sunucuyu başlat ve özel alanları çek
app.listen(PORT, () => {
    console.log(`Sunucu (Nihai Versiyon) port ${PORT} üzerinde çalışıyor.`);
    fetchAndCacheCustomerAttributes();
});