const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection configuration
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Four4444.',
  database: 'license_test_db'
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// Register a new test taker
app.post('/register', (req, res) => {
  const { id, first_name, last_name } = req.body;
  const query = 'INSERT INTO Users (id, first_name, last_name, status) VALUES (?, ?, ?, "pending")';
  db.execute(query, [id, first_name, last_name], (err, result) => {
    if (err) {
      console.error('Error registering user:', err);
      return res.status(500).send('Failed to register user');
    }
    res.send('User registered successfully');
  });
});


app.post('/tests/physical', (req, res) => {
  const {id, test_id, color_blind_test, long_sight_test, short_sight_test, response_test } = req.body;
  
  // Ensure all values are provided, replace undefined with null
  const validId = test_id || null;
  const validColorBlindTest = color_blind_test || null;
  const validLongSightTest = long_sight_test || null;
  const validShortSightTest = short_sight_test || null;
  const validResponseTest = response_test || null;

  // Validate test results
  const validResults = ['pass', 'fail'];
  const tests = [validColorBlindTest, validLongSightTest, validShortSightTest, validResponseTest];
  const allValidResults = tests.every(test => validResults.includes(test));

  if (!allValidResults) {
    return res.status(400).send('Invalid test result values provided.');
  }

  const passedTests = tests.filter(test => test === 'pass').length;
  const physicalResult = passedTests >= 3 ? 'pass' : 'fail';
  
  const query = 'INSERT INTO Physical_Test_Result (test_id, result, test_date) VALUES (?, ?, NOW())';
  db.execute(query, [validId, physicalResult], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error recording physical test: ' + err.message);
    }
    res.send(`Physical test recorded with result: ${physicalResult}`);
  });
});




app.post('/tests/theory', (req, res) => {
  const {id, test_id, traffic_signs, road_lines, yielding } = req.body;
  
  // Ensure all values are provided, replace undefined with null
  const validId =  id || null;
  const validtestId =  test_id || null;
  const validTrafficSigns = traffic_signs || 0;
  const validRoadLines = road_lines || 0;
  const validYielding = yielding || 0;

  const totalScore = validTrafficSigns + validRoadLines + validYielding;
  const averageScore = totalScore ;
  const theoryResult = averageScore > 120 ? 'pass' : 'fail';

  const query = 'INSERT INTO Tests (test_id, test_type, result, test_date) VALUES (?, "theory", ?, NOW())';
  db.execute(query, [validId, theoryResult], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send(`Theory test recorded with result: ${theoryResult}`);
  });
});



app.post('/tests/practical', (req, res) => {
  const { test_id, result } = req.body;
  
  // Ensure id is provided, replace undefined with null if needed
  const validId = test_id || null;
  const validResult = result || 'fail'; // Assuming 'fail' is a default value

  const query = 'INSERT INTO Tests (test_id, test_type, result, test_date) VALUES (?, "practical", ?, NOW())';
  db.execute(query, [validId, validResult], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send(`Practical test recorded with result: ${validResult}`);
  });
});



app.get('/status', (req, res) => {
  const { name } = req.query;
  const query = `
    SELECT Users.first_name, Users.last_name, Tests.test_type, Tests.result
    FROM Users
    JOIN Tests ON Users.id = Tests.id
    WHERE Users.first_name = ? OR Users.last_name = ?
    ORDER BY Tests.test_date
  `;

  db.execute(query, [name, name], (err, results) => {
    if (err) return res.status(500).send(err);

    const tests = results.reduce((acc, row) => {
      if (!acc[row.first_name]) acc[row.first_name] = {};
      if (!acc[row.first_name][row.last_name]) acc[row.first_name][row.last_name] = { tests: {}, status: '' };

      acc[row.first_name][row.last_name].tests[row.test_type] = row.result;

      return acc;
    }, {});

    const status = Object.values(tests).map(users => {
      return Object.entries(users).map(([user, userTests]) => {
        const { tests } = userTests;
        const allTestsPassed = ['physical', 'theory', 'practical'].every(type => tests[type] === 'pass');
        userTests.status = allTestsPassed ? 'Passed All Tests' : 'Pending Review';
        return { user, ...userTests };
      });
    }).flat();

    res.send(status);
  });
});





app.get('/report', (req, res) => {
  const { firstname, lastname } = req.query;
  const query = `
    SELECT Users.first_name, Users.last_name, Tests.test_type, Tests.result, COUNT(*) AS test_count
    FROM Users
    JOIN Tests ON Users.id = Tests.id
    WHERE Users.first_name = ? OR Users.last_name = ?
    GROUP BY Users.id, Tests.test_type
  `;

  db.execute(query, [firstname, lastname], (err, results) => {
    if (err) return res.status(500).send(err);

    const report = results.reduce((acc, row) => {
      const { first_name, last_name, test_type, result, test_count } = row;
      if (!acc[first_name]) acc[first_name] = {};
      if (!acc[first_name][last_name]) acc[first_name][last_name] = { tests: {}, totalPassed: 0, totalFailed: 0 };

      acc[first_name][last_name].tests[test_type] = result;
      if (result === 'pass') acc[first_name][last_name].totalPassed += test_count;
      else acc[first_name][last_name].totalFailed += test_count;

      return acc;
    }, {});

    res.send(report);
  });
});



// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
