const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();
const jwt = require('jsonwebtoken')

const app = express();
const SECRET_KEY = '11!834*q'
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("/tmp/data.db");

// Create table
db.serialize(() => {

  // Enable foreign keys
  db.run("PRAGMA foreign_keys = ON", () => console.log("Foreign Keys"));

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      avatar TEXT,
      gender TEXT,
      friend_emails TEXT DEFAULT '[]',
      friend_requests TEXT DEFAULT '[]'
    )
  `, () => console.log("Users Table"));

  // Tasks table
  db.run(`
    CREATE TABLE IF NOT EXISTS task (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status INTEGER DEFAULT 0,
      user_email INTEGER NOT NULL,
      date TEXT NOT NULL,
      repeat INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1,
      
      FOREIGN KEY(user_email)
      REFERENCES users(email)
      ON DELETE CASCADE
    )
  `, () => console.log("Tasks Table"));

});

// =========================
// JWT VERIFY MIDDLEWARE
// =========================

function verifyToken(req, res, next) {

  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      error: "No token provided"
    });
  }

  // Bearer TOKEN


  jwt.verify(token, SECRET_KEY, (err, decoded) => {

    if (err) {
      return res.status(403).json({
        error: "Invalid token"
      });
    }

    req.user = decoded;

    next();

  });

}

// Health API
app.get("/", (req, res) => {
  res.json({
    status: "Server running"
  });
});

//       Auth
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  console.log("fetchlogin")
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, result) => {

    if (err) {
      return res.status(500).json({
        error: err.message
      });
    }

    if (result.password == password) {
      const token = jwt.sign(
        {

          email: result.email
        },
        SECRET_KEY,
        {
          expiresIn: "7d"
        }
      );

      return res.json({
        token,
        user: {

          email: result.email,
          name: result.name
        }
      });




    } else {
      return res.json({ 'msg': `Login Failed ${email}` })
    }

  });
});


app.post("/signin", (req, res) => {
  console.log("post");
  const { name, email, password,avatar, gender } = req.body;
  console.log(req.body);
  db.run(
    "INSERT INTO users(name,email,password,avatar,gender) VALUES(?,?,?,?,?)",
    [name, email, password, avatar,gender],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message
        });

      res.json({
        "msg": `Account created for ${email}`
      });
    }
  );
});

// SEARCH EMAIL 
app.post('/search', verifyToken, (req, res) => {
  //avatar
  db.all(
    `
    SELECT email, name 
    FROM users
    `,
    [],
    (err, result) => {

      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }
      res.json(result);

    }
  );

});


//TASKS APIs
app.post('/task/list', verifyToken, (req, res) => {
  console.log('tasksftecg')
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: "Email required"
    });
  }

  db.all(
    `
    SELECT *
    FROM task
    WHERE user_email = ?
    `,
    [email],
    (err, tasks) => {

      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.json(tasks);

    }
  );

});

app.post('/task/create', verifyToken, (req, res) => {

  const {
    title,
    date,
    repeat,
    visible,
    email
  } = req.body;

  db.run(
    `
    INSERT INTO task
    (
      title,
      date,
      repeat,
      visible,
      status,
      user_email
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      title,
      date,
      repeat,
      visible,
      0,
      email
    ],
    function (err) {

      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.json({
        success: true,
        id: this.lastID
      });

    }
  );

});

app.post('/task/edit/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  const { email, title, date, completed, repeat, visible } = req.body;


  db.run(`UPDATE task SET title = ? , date = ?, status = ? , repeat = ?, visible = ?  WHERE id= ? AND user_email = ? `, [title, date, completed, repeat, visible, id, email],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message
        });

      res.json({
        "msg": `Task Edited`
      });
    }
  )

});

app.post('/task/complete/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { status, email } = req.body;
  console.log(req.body);
  db.run(`UPDATE task SET status = ?  WHERE id= ? AND user_email = ? `, [status, id, email],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message
        });

      res.json({
        "msg": `Task Status Changed`
      });
    }
  );
});

app.post('/task/visible/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { visible, email } = req.body;
  db.run(`UPDATE task SET visible = ?  WHERE id= ? AND user_email = ? `, [visible, id, email],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message
        });

      res.json({
        "msg": `Task visiblity Changed`
      });
    }
  );
});

app.post('/task/recurring/:id', verifyToken, async (req, res) => {
  const id = req.params.id;
  const { recurring, email } = req.body;
  db.run(`UPDATE task SET repeat = ?  WHERE id= ? AND user_email = ? `, [recurring, id, email],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message
        });

      res.json({
        "msg": `Task recurring Changed`
      });
    }
  );
});


app.delete('/task/delete/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  const { email } = req.body;


  db.run(`DELETE FROM task WHERE id= ? AND user_email = ? `, [id, email],
    function (err) {
      if (err)
        return res.status(500).json({
          error: err.message
        });

      res.json({
        "msg": `Task Deleted`
      });
    }
  )

});

app.post('/friend-tasks', verifyToken, (req, res) => {

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: "Email required"
    });
  }

  db.get(
    `
    SELECT friend_emails
    FROM users
    WHERE email = ?
    `,
    [email],
    (err, user) => {

      if (err || !user) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      let friends = [];

      try {

        friends = JSON.parse(
          user.friend_emails || "[]"
        );



      } catch {
        friends = [];
      }
      console.log("Friends", friends);
      // No friends
      if (friends.length === 0) {
        return res.json([]);
      }

      let tasksAll = {};
      let completedQueries = 0;

      friends.forEach(friendEmail => {

        db.all(
          `
  SELECT 
    task.*,
    users.name,
    
    

  FROM task

  JOIN users
  ON task.user_email = users.email

  WHERE task.user_email = ?
  AND task.visible = 1
  `,
          [friendEmail],
          (err, tasks) => {
            console.log(tasks);
            completedQueries++;

            if (!err && tasks) {

              tasks.forEach(task => {
                const friendName = task.name;
                if (!tasksAll[friendName]) {
                  tasksAll[friendName] = {
                    
                    tasks: []
                  };
                }
                tasksAll[friendName].tasks.push(task);
              })

            }

            // All queries finished
            if (completedQueries === friends.length) {



              return res.json(tasksAll);

            }

          }
        );

      });

    }
  );

});
//Friend Request -> Acceptance Flow

app.post('/friend-request', verifyToken, (req, res) => {
  const { email, friendEmail } = req.body;
  console.log("heh");
  db.run(
    `
                UPDATE users
                SET friend_requests = ?
                WHERE email = ?
                `,
    [
      JSON.stringify(email),
      friendEmail
    ]
  );
  res.json({
    "msg": `Request Sent to ${friendEmail}`
  });

});

app.post('/friend-request/list', verifyToken, (req, res) => {

  const { email } = req.body;

  db.get(
    `
    SELECT friend_requests, name
    FROM users
    WHERE email = ?
    `,
    [email],
    (err, row) => {

      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      if (!row) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      res.json({
  friend_requests: JSON.parse(
    row.friend_requests || "[]"
  ),
  name: row.name
});

    }
  );

});



app.post('/friend-request/approve', verifyToken, async (req, res) => {

  const { email, friendEmail } = req.body;

  if (!email || !friendEmail) {
    return res.status(400).json({
      error: "email and friendEmail required"
    });
  }

  // Current user
  db.get(
    `
    SELECT *
    FROM users
    WHERE email = ?
    `,
    [email],
    (err, user) => {

      if (err || !user) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      // Friend user
      db.get(
        `
        SELECT *
        FROM users
        WHERE email = ?
        `,
        [friendEmail],
        (err, friendUser) => {

          if (err || !friendUser) {
            return res.status(404).json({
              error: "Friend user not found"
            });
          }

          // Parse arrays
          let requests =
            JSON.parse(user.friend_requests || "[]");

          let userFriends =
            JSON.parse(user.friend_emails || "[]");

          let friendFriends =
            JSON.parse(friendUser.friend_emails || "[]");

          // Remove request
          if (requests > 0) {
            requests =
              requests.filter(
                e => e !== friendEmail
              );
          }

          // Add friend to current user
          if (!userFriends.includes(friendEmail)) {
            userFriends.push(friendEmail);
          }

          // Add current user to friend
          if (!friendFriends.includes(email)) {
            friendFriends.push(email);
          }

          // Update current user
          db.run(
            `
            UPDATE users
            SET
              friend_requests = ?,
              friend_emails = ?
            WHERE email = ?
            `,
            [
              JSON.stringify(requests),
              JSON.stringify(userFriends),
              email
            ],
            (err) => {

              if (err) {
                return res.status(500).json({
                  error: err.message
                });
              }

              // Update friend user
              db.run(
                `
                UPDATE users
                SET friend_emails = ?
                WHERE email = ?
                `,
                [
                  JSON.stringify(friendFriends),
                  friendEmail
                ],
                (err) => {

                  if (err) {
                    return res.status(500).json({
                      error: err.message
                    });
                  }

                  res.json({
                    msg: "Friend request approved",
                    userFriends,
                    friendFriends
                  });

                }
              );

            }
          );

        }
      );

    }
  );

});




app.post('/friend-request/decline', verifyToken, (req, res) => {

  const { email, friendEmail } = req.body;

  db.get(
    `
    SELECT *
    FROM users
    WHERE email = ?
    `,
    [email],
    (err, user) => {

      if (err || !user) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      // Parse requests
      let requests =
        JSON.parse(user.friend_requests || "[]");

      // Remove declined request
      requests =
        requests.filter(
          e => e !== friendEmail
        );

      // Update only friend_requests
      db.run(
        `
        UPDATE users
        SET friend_requests = ?
        WHERE email = ?
        `,
        [
          JSON.stringify(requests),
          email
        ],
        (err) => {

          if (err) {
            return res.status(500).json({
              error: err.message
            });
          }

          res.json({
            msg: "Friend request declined",
            friend_requests: requests
          });

        }
      );

    }
  );

});

app.post('/friend/remove', verifyToken, (req, res) => {

  const { email, friendEmail } = req.body;

  if (!email || !friendEmail) {
    return res.status(400).json({
      error: "email and friendEmail required"
    });
  }

  // Current user
  db.get(
    `
    SELECT friend_emails
    FROM users
    WHERE email = ?
    `,
    [email],
    (err, user) => {

      if (err || !user) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      // Friend user
      db.get(
        `
        SELECT friend_emails
        FROM users
        WHERE email = ?
        `,
        [friendEmail],
        (err, friendUser) => {

          if (err || !friendUser) {
            return res.status(404).json({
              error: "Friend user not found"
            });
          }

          let userFriends =
            JSON.parse(user.friend_emails || "[]");

          let friendFriends =
            JSON.parse(friendUser.friend_emails || "[]");

          // Remove each other
          userFriends =
            userFriends.filter(
              e => e !== friendEmail
            );

          friendFriends =
            friendFriends.filter(
              e => e !== email
            );

          // Update current user
          db.run(
            `
            UPDATE users
            SET friend_emails = ?
            WHERE email = ?
            `,
            [
              JSON.stringify(userFriends),
              email
            ],
            (err) => {

              if (err) {
                return res.status(500).json({
                  error: err.message
                });
              }

              // Update friend user
              db.run(
                `
                UPDATE users
                SET friend_emails = ?
                WHERE email = ?
                `,
                [
                  JSON.stringify(friendFriends),
                  friendEmail
                ],
                (err) => {

                  if (err) {
                    return res.status(500).json({
                      error: err.message
                    });
                  }

                  return res.json({
                    msg: "Friend removed successfully",
                    userFriends,
                    friendFriends
                  });

                }
              );

            }
          );

        }
      );

    }
  );

});

app.post('/friend/list', verifyToken, (req,res)=>{
  const {email} = req.body;
  //u2.avatar
  db.all('SELECT u2.name, u2.email FROM users u1 JOIN users u2 ON instr(u1.friend_emails,u2.email) > 0 WHERE u1.email = ?',[email], (err,rows)=>{

      if (err) {

        return res.status(500).json({
          error: err.message
        });
      }
      console.log(rows);
      res.json(rows);
    }
  );
});

app.get('/admin/users', (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res.json({ "msg": "Unauthorized" });
  }
  db.all('SELECT * FROM users ', (err, data) => {
    if (err) {
      return res.json({ "Error": err })
    }
    return res.json(data)
  })
});

app.get('/admin/task', (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res.json({ "msg": "Unauthorized" });
  }
  db.all('SELECT * FROM task ', (err, data) => {
    if (err) {
      return res.json({ "Error": err })
    }
    return res.json(data)
  })
});







const PORT = 3177;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});