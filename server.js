const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

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

// Test endpoint'i
app.get('/', (req, res) => {
    res.send('Backend sunucusu çalışıyor ve isteklere cevap veriyor!');
});

// Müşterileri listeleyen endpoint
app.get('/api/customers', async (req, res) => {
    try {
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        });
        const authResponse = await axios.post(AUTH_URL, params);
        const accessToken = authResponse.data.access_token;

        const query = `query($merchantId: StringFilterInput!) { listCustomer(merchantId: $merchantId, pagination: {limit: 100}) { data { id, fullName, email, orderCount } } }`;
        const variables = { merchantId: { eq: MERCHANT_ID } };

        const graphqlResponse = await axios.post(
            GRAPHQL_API_URL,
            { query, variables },
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (graphqlResponse.data.errors) {
            throw new Error(`GraphQL Hatası: ${graphqlResponse.data.errors[0].message}`);
        }

        res.status(200).json(graphqlResponse.data.data.listCustomer.data);

    } catch (error) {
        console.error('!!! /api/customers rotasında hata:', error.message);
        res.status(500).json({ message: 'Müşteri verileri alınırken sunucuda bir hata oluştu.' });
    }
});

// Belirli bir müşteri için PDF oluşturan endpoint
app.get('/api/customer/:id/pdf', async (req, res) => {
    const { id } = req.params;
    console.log(`PDF isteği alındı, müşteri ID: ${id}`);

    try {
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        });
        const authResponse = await axios.post(AUTH_URL, params);
        const accessToken = authResponse.data.access_token;
        console.log(`PDF için token alındı, müşteri ID: ${id}`);

        const query = `
          query GetCustomerById($merchantId: StringFilterInput!, $customerId: StringFilterInput!) {
            listCustomer(merchantId: $merchantId, id: $customerId) {
              data {
                id
                fullName
                email
                phone
                orderCount
                totalOrderPrice
                note
                firstOrderDate
                lastOrderDate
                addresses {
                  title
                  addressLine1
                  addressLine2
                  postalCode
                  district { name }
                  city { name }
                  country { name }
                  isDefault
                }
              }
            }
          }
        `;
        const variables = {
            merchantId: { eq: MERCHANT_ID },
            customerId: { eq: id }
        };
        
        const graphqlResponse = await axios.post(
            GRAPHQL_API_URL,
            { query, variables },
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (graphqlResponse.data.errors) {
            throw new Error(`PDF için GraphQL Hatası: ${graphqlResponse.data.errors[0].message}`);
        }

        const customer = graphqlResponse.data.data.listCustomer.data[0];

        if (!customer) {
            return res.status(404).send('Müşteri bulunamadı');
        }
        console.log(`PDF için müşteri verisi çekildi: ${customer.fullName}`);

        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.text("Müşteri Bilgi Raporu", 14, 22);
        
        doc.setFontSize(16);
        doc.text(customer.fullName || 'İsim Yok', 14, 32);

        const customerInfo = [
            ["E-posta", customer.email || 'N/A'],
            ["Telefon", customer.phone || 'N/A'],
            ["Sipariş Sayısı", customer.orderCount?.toString() || '0'],
            ["Toplam Sipariş Tutarı", customer.totalOrderPrice?.toString() || '0'],
            ["İlk Sipariş", customer.firstOrderDate ? new Date(customer.firstOrderDate).toLocaleDateString() : 'N/A'],
            ["Son Sipariş", customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'N/A'],
            ["Not", customer.note || 'Yok'],
        ];

        doc.autoTable({
            startY: 40,
            head: [['Alan', 'Değer']],
            body: customerInfo,
            theme: 'grid',
            styles: { font: "helvetica", cellPadding: 2 },
            headStyles: { fillColor: [22, 160, 133] }
        });
        
        if (customer.addresses && customer.addresses.length > 0) {
            const finalY = doc.lastAutoTable.finalY; // Bir önceki tablonun bittiği yeri al
            doc.text("Adres Bilgileri", 14, finalY + 15);
            
            const addressBody = customer.addresses.map(addr => [
                addr.title,
                `${addr.addressLine1 || ''} ${addr.addressLine2 || ''}`.trim(),
                `${addr.district?.name || ''} / ${addr.city?.name || ''}`.trim(),
                addr.country?.name || '',
            ]);

            doc.autoTable({
                startY: finalY + 20,
                head: [['Başlık', 'Adres', 'İlçe/Şehir', 'Ülke']],
                body: addressBody,
                theme: 'striped'
            });
        }
        
        const pdfBuffer = doc.output('arraybuffer');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="musteri-${customer.id}.pdf"`);

        res.send(Buffer.from(pdfBuffer));
        console.log(`PDF başarıyla oluşturuldu ve gönderildi: ${customer.fullName}`);

    } catch (error) {
        console.error(`!!! PDF oluşturulurken KRİTİK HATA, müşteri ID: ${id}`, error.message);
        res.status(500).json({ message: 'PDF oluşturulurken sunucuda bir hata oluştu.' });
    }
});

app.listen(PORT, () => console.log(`Sunucu port ${PORT} üzerinde çalışıyor.`));

// jsPDF autoTable eklentisi için
function autoTable(doc, options) { doc.autoTable(options); }