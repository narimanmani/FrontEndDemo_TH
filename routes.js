const express = require('express');
const multer = require('multer');
const axios = require('axios');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const fs1 = require('fs').promises;
const router = express.Router();

// Define routes
router.get('/users',  async (req, res) => {

    try {
        const usersData = await fs1.readFile('users.json', 'utf8');
        const itemsData = await fs1.readFile('items.json', 'utf8');

        const users = JSON.parse(usersData);
        const items = JSON.parse(itemsData);

        // Combine user data with their items
        const usersWithItems = users.map(user => {
            return {
                ...user,
                items: items.filter(item => item.userId === user.id)
            };
        });

        res.json(usersWithItems);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

router.get('/users/:id', (req, res) => {
    const userId = parseInt(req.params.id, 10);

    fs.readFile('users.json', 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading file');
            return;
        }

        try {
            const users = JSON.parse(data);
            const user = users.find(u => u.id === userId);

            if (user) {
                res.json(user);
            } else {
                res.status(404).send('User not found');
            }
        } catch (error) {
            res.status(500).send('Error parsing JSON');
        }
    });
});


router.use(express.json()); // Middleware to parse JSON bodies
router.post('/users', (req, res) => {
    console.log(req.body); 
    const newUser = req.body; // Assuming newUser has name and email

    fs.readFile('users.json', 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading file');
            return;
        }

        try {
            const users = JSON.parse(data);

            // Generate a unique ID
            const newId = users.length > 0 ? Math.max(...users.map(user => user.id)) + 1 : 1;
            newUser.id = newId;

            users.push(newUser); // Add the new user

            fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
                if (err) {
                    res.status(500).send('Error writing to file');
                    return;
                }
                res.status(201).json(newUser);
            });
        } catch (error) {
            res.status(500).send('Error parsing JSON');
        }
    });
});

router.put('/users/:id', (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const updatedUserData = req.body;

    fs.readFile('users.json', 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading file');
            return;
        }

        try {
            let users = JSON.parse(data);
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex !== -1) {
                // Update the user's details
                users[userIndex] = { id: userId, ...updatedUserData };

                fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
                    if (err) {
                        res.status(500).send('Error writing to file');
                        return;
                    }
                    res.json(users[userIndex]);
                });
            } else {
                res.status(404).send('User does not exist');
            }
        } catch (error) {
            res.status(500).send('Error parsing JSON');
        }
    });
});



router.put('/usersWithItems/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const updatedUserData = req.body
    console.log(req.body);
    try {
        // Read the existing users and items
        const usersData = await fs1.readFile('users.json', 'utf8');
        const itemsData = await fs1.readFile('items.json', 'utf8');

        let users = JSON.parse(usersData);
        let itemsBackend = JSON.parse(itemsData);

         // Separate user data and items
         const { items: updatedItems, ...updatedUser } = updatedUserData.user;
    
        // Update user data
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex] = updatedUser;
        } else {
            return res.status(404).send('User not found');
        }

          // Update items data
          const updatedItemsWithUserId = updatedItems.map(item => ({ ...item, userId }));
          itemsBackend = itemsBackend.filter(item => item.userId !== userId).concat(updatedItemsWithUserId);
  

        // Save the updated data back to the files
        await fs1.writeFile('users.json', JSON.stringify(users, null, 2));
        await fs1.writeFile('items.json', JSON.stringify(itemsBackend, null, 2));

        res.json({ message: 'User and items updated successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

router.delete('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    try {
        // Read the existing users and items
        const usersData = await fs1.readFile('users.json', 'utf8');
        const itemsData = await fs1.readFile('items.json', 'utf8');

        let users = JSON.parse(usersData);
        let items = JSON.parse(itemsData);

        // Remove the user
        const userIndex = users.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            return res.status(404).send('User not found');
        }
        users.splice(userIndex, 1);

        // Remove items associated with the user
        items = items.filter(item => item.userId !== userId);

        // Save the updated data back to the files
        await fs1.writeFile('users.json', JSON.stringify(users, null, 2));
        await fs1.writeFile('items.json', JSON.stringify(items, null, 2));

        res.json({ message: 'User and related items deleted successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});


router.post('/generate-invoice', async (req, res) => {
    const invoiceData = req.body;
    console.log(req.body); 

    try {
        const html = await ejs.renderFile(__dirname + '/invoice.ejs', { invoice: invoiceData });

     // Launch browser with no-sandbox option - for Heruko
     const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
        const page = await browser.newPage();
        await page.setContent(html);

        // Generate a unique filename
        const filename = `invoice-${Date.now()}.pdf`;
        const filePath = path.join(__dirname, 'public', filename);

        // Save PDF to the public directory
        await page.pdf({ path: filePath, format: 'A4' });
        await browser.close();

        // Return the download link
        res.json({ downloadLink: `http://${req.headers.host}/${filename}` });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating PDF');
    }
});

const formatDate = (date) => {
    // Format the date as 'YYYY-MM-DD' or any other format you prefer
    return date.toISOString().split('T')[0];
};


// Build pack is added for heroku for puppeteer 
router.get('/usersInvoices/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const HST_RATE = 0.13; // 13% HST
    try {
        // Read user and item data
        const usersData = await fs1.readFile(path.join(__dirname, 'users.json'), 'utf8');
        const itemsData = await fs1.readFile(path.join(__dirname, 'items.json'), 'utf8');

        const users = JSON.parse(usersData);
        const items = JSON.parse(itemsData);

 

        // Find the user and their items
        const user = users.find(u => u.id === userId);
        const userItems = items.filter(item => item.userId === userId);

        // Calculate total amount
         const subtotal = userItems.reduce((total, item) => total + item.price * item.quantity, 0);
         const tax = subtotal * HST_RATE;
         const total = subtotal + tax;
         const today = formatDate(new Date()); // Add formatted date
    

         const imagePath = path.join(__dirname, 'public', 'logo-white.png');
         const imageAsBase64 = await fs1.readFile(imagePath, { encoding: 'base64' });
         const base64ImageSrc = `data:image/png;base64,${imageAsBase64}`;
 

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Construct the invoice data
        const invoiceData = {
            user: user,
            items: userItems,
            // ... any other data needed for the invoice
        };

        console.log(base64ImageSrc);

        // Generate invoice using ejs, puppeteer or your preferred method
        console.log(invoiceData.user.name);
        const html = await ejs.renderFile(path.join(__dirname, 'invoice2.ejs'), { user, userItems,subtotal, tax , total , today, base64ImageSrc });

       // Launch browser with no-sandbox option - for Heruko
     const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
        const page = await browser.newPage();
        await page.setContent(html);

        // Define path for saving the invoice PDF
        const invoicePath = path.join(__dirname, 'public', `invoice-${userId}-${Date.now()}.pdf`);
        await page.pdf({ path: invoicePath, format: 'letter' });
        await browser.close();

        // Return the download link
        res.json({ downloadLink: `https://${req.headers.host}/${path.basename(invoicePath)}` });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
});

// Ensure the 'uploads' directory exists
const uploadsDir = path.join(__dirname, 'uploads');
fs.existsSync(uploadsDir) || fs.mkdirSync(uploadsDir);

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // You can use file.originalname or add Date.now() for uniqueness
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Upload endpoint
router.post('/upload', (req, res, next) => {
    upload.array('files')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            console.error('Multer Error:', err);
            return res.status(500).send(err.message);
        } else if (err) {
            // An unknown error occurred when uploading.
            console.error('Unknown Upload Error:', err);
            return res.status(500).send(err.message);
        }

        // Everything went fine, proceed with the rest of the route
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }
        const uploadedFiles = req.files.map(file => file.filename);
        console.log("Files uploaded successfully");
        res.send(`Files uploaded successfully: ${uploadedFiles.join(', ')}`);
    });
});


router.get('/inflation', async (req, res) => {
    try {
        // Get the number of months from the query string, default to 120 if not provided
        const months = req.query.months || '120';
        
        // Construct the API URL with the dynamic 'recent' parameter
        const url = `https://www.bankofcanada.ca/valet/observations/group/CPI_MONTHLY/json?recent=${months}`;

        const response = await axios.get(url);
        const data = response.data;

        // Process and structure the data
        const processedData = {
            dates: data.observations.map(obs => obs.d),
            rates: data.observations.map(obs => obs.CPIW ? obs.CPIW.v : null)
        };

        res.json(processedData);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching inflation data');
    }
});
router.get('/overnight-rates', async (req, res) => {
    try {
        // Get the number of months from the query string, default to 120 if not provided
        const months = req.query.months || '120';

        // Construct the API URL with the dynamic 'recent' parameter
        const apiURL = `https://www.bankofcanada.ca/valet/observations/V122514/json?recent=${months}`;
        
        const response = await axios.get(apiURL);
        const data = response.data;

        // Process and structure the data
        const processedData = {
            dates: data.observations.map(obs => obs.d),
            rates: data.observations.map(obs => obs.V122514.v)
        };

        res.json(processedData);
    } catch (error) {
        console.error('Error fetching overnight rates:', error);
        res.status(500).send('Error fetching overnight rates');
    }
});
router.get('/test', (req, res) => {
    res.send('Test route works');
  });

module.exports = router;

/* router.post('/usersInvoices', async (req, res) => {
    const { user, items } = req.body; // Assuming input has user and items

    try {
        // Read and parse the existing users and items
        const usersData = await fs1.readFile('users.json', 'utf8');
        const users = JSON.parse(usersData);
        const itemsData = await fs1.readFile('items.json', 'utf8');
        const allItems = JSON.parse(itemsData);

        // Generate a unique ID for the new user
        const newUserId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
        user.id = newUserId;

        // Generate the invoice for the new user
        const html = await ejs.renderFile(__dirname + '/invoice2.ejs', { user, items });
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(html);

        // Generate a unique filename for the invoice
        const filename = `invoice-${newUserId}-${Date.now()}.pdf`;
        const filePath = path.join(__dirname, 'public', filename);

        // Save PDF to the public directory
        await page.pdf({ path: filePath, format: 'A4' });
        await browser.close();

        // Construct the download link for the invoice
        const downloadLink = `http://${req.headers.host}/${filename}`;

        // Save the new user with the invoice link
        user.invoiceDownloadLink = downloadLink;
        users.push(user);

        // Save the items with a reference to the user ID
        items.forEach(item => {
            allItems.push({ ...item, userId: newUserId });
        });

        // Save the updated users and items arrays back to their files
        await fs1.writeFile('users.json', JSON.stringify(users, null, 2));
        await fs1.writeFile('items.json', JSON.stringify(allItems, null, 2));

        res.status(201).json({ user, downloadLink });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred');
    }
}); */

