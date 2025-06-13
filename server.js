// backend/server.js - GÜÇLENDİRİLMİŞ VE DETAYLI LOGLAMALI VERSİYON

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

const app = express();
const PORT = process.env.PORT || 3001;

// --- İKAS BİLGİLERİN ---
// BU BİLGİLERİN %100 DOĞRU OLDUĞUNDAN EMİN OL
const IKAS_STORE_NAME = 'ikas201';
const CLIENT_ID = '934f561e-8562-47e5-91a0-84e8a94f20e6';
const CLIENT_SECRET = 's_YLVuWzUHlTcLC8QhYpriSRc724f2d20350d74e8e8e81eb22729b2fbb';
const MERCHANT_ID = 'f2d4fb72-0450-4adc-a51a-5f1a120a7976';

const AUTH_URL = `https://${IKAS_STORE_NAME}.myikas.com/api/admin/oauth/token`;
const GRAPHQL_API_URL = 'https://api.myikas.com/api/v1/admin/graphql';

// Cors ayarını daha geniş kapsamlı yapalım
app.use(cors({ origin: '*' }));

// Test endpoint'i
app.get('/', (req, res) => {
    console.log("Ana endpoint'e istek geldi.");
    res.send('Backend sunucusu çalışıyor ve isteklere cevap veriyor!');
});

// Müşterileri çeken ana endpoint
app.get('/api/customers', async (req, res) => {
    console.log('>>> /api/customers isteği alındı. İşlem başlatılıyor...');

    try {
        // 1. Adım: Access Token Al
        console.log('1. Adım: Access token alınmaya çalışılıyor...');
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        });
        const authResponse = await axios.post(AUTH_URL, params);
        const accessToken = authResponse.data.access_token;
        console.log('✓ Access token başarıyla alındı.');

        // 2. Adım: GraphQL Sorgusunu Çalıştır
        console.log('2. Adım: GraphQL isteği gönderiliyor...');
        const query = `query($merchantId: StringFilterInput!) { listCustomer(merchantId: $merchantId, pagination: {first: 100}) { data { id, fullName, email, orderCount } } }`;
        const variables = { merchantId: { eq: MERCHANT_ID } };

        const graphqlResponse = await axios.post(
            GRAPHQL_API_URL,
            { query, variables },
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (graphqlResponse.data.errors) {
            // GraphQL'in kendi hata mesajını logla
            console.error('!!! GraphQL API bir hata döndürdü:', graphqlResponse.data.errors);
            throw new Error(`GraphQL Hatası: ${graphqlResponse.data.errors[0].message}`);
        }

        console.log('✓ Müşteri verileri başarıyla çekildi. Cevap gönderiliyor.');
        res.status(200).json(graphqlResponse.data.data.listCustomer.data);

    } catch (error) {
        // HATA YAKALAMA BLOĞU
        console.error('!!! /api/customers rotasında KRİTİK HATA YAKALANDI !!!');
        if (error.response) {
            // Axios hatası (ikas API'sinden gelen bir hata)
            console.error('Hata Detayları (Response):', error.response.data);
            console.error('Hata Kodu (Status):', error.response.status);
            console.error('Hata Başlıkları (Headers):', error.response.headers);
        } else {
            // Genel hata (bağlantı sorunu, kod hatası vb.)
            console.error('Genel Hata Mesajı:', error.message);
        }
        
        // Frontend'e 500 hatası gönder
        res.status(500).json({
            message: 'Sunucuda bir iç hata oluştu. Lütfen Render loglarını kontrol edin.',
            error: error.message
        });
    }
});

// PDF endpoint'ini şimdilik basit bırakıyoruz.
app.get('/api/customer/:id/pdf', async (req, res) => {
    res.send(`PDF endpoint'i için müşteri ID: ${req.params.id}`);
});


app.listen(PORT, () => console.log(`Gelişmiş loglamalı sunucu port ${PORT} üzerinde çalışıyor.`));