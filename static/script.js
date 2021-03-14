document.addEventListener("DOMContentLoaded", () => {
  $("#alertSystem").hide();
  // Connect to websocket
  var socket = io.connect(
    location.protocol + "//" + document.domain + ":" + location.port
  );

  // Prevents Enter key to submit all form inputs
  const formList = document.querySelectorAll(".inputForm");
  formList.forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  });

  // When connected, do:
  socket.on("connect", () => {
    // Logs in
    login();
  });

  /*


    For messaging related


    */

  // Prevents sending empty messages
  validInput("#sendButton", "#chatInput");

  // Listens for clicks and submits message to server
  document.getElementById("sendButton").onclick = () => {
    const channel = localStorage.getItem("channel");
    const message = document.getElementById("chatInput").value;
    sendMessage(message, channel);
  };

  // Sends message through Enter key if not empty
  document.getElementById("chatInput").addEventListener("keyup", (e) => {
    if (e.keyCode === 13) {
      const channel = localStorage.getItem("channel");
      const message = document.getElementById("chatInput");
      if (message.value.length > 0) {
        sendMessage(message.value, channel);
        message.value = "";
      }
    }
  });

  // Display sent messages in page
  socket.on("return message", (data) => {
    const user = data["user"];
    const message = data["messageField"];
    const time = data["currentTime"];
    createMessage(user, message, time);
  });

  socket.on("alert", (data) => {
    const user = data["user"];
    const message = data["messageFeild"];
  });

  // Display previous messages in the room from messagesArchive
  socket.on("receive previous messages", (data) => {
    document.querySelector("#messagesList").innerHTML = "";
    data.forEach((message) => {
      // receiving previous messages from server
      createMessage(message[3], message[0], message[2]);
    });
  });

  function createMessage(user, message, time) {
    const div = document.createElement("div");
    div.classList.add("container-chat");
    const span = document.createElement("span");
    span.classList.add("time-left");
    span.append(time);
    const p = document.createElement("p");
    p.innerHTML = "<strong>" + user + "</strong>" + " " + message;
    div.append(p);
    div.append(span);

    var mainUser = localStorage.getItem("username");

    if (mainUser == user) {
      div.style.textAlign = "right";
      div.style.backgroundColor = "#ccf2f4";
      div.style.width = "fit-content";
      div.style.marginLeft = "80%";
      div.style.marginRight = "auto";
    } else {
      div.style.textAlign = "left";
      div.style.backgroundColor = "#a4ebf3";
      div.style.width = "fit-content";
      div.style.marginRight = "80%";
      div.style.marginLeft = "auto";
    }
    document.getElementById("messagesList").append(div);
    const messagesWindow = document.querySelector("#mainContent");
    //messagesWindow.scrollTop = messagesWindow.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  }

  /*
    For channel related



    */

  // Receiving channel as list and displaying on page
  socket.on("receive channels", (data) => {
    document.querySelector("#channelList").innerHTML = "";
    // Gets array of channels and create html for each one
    data.forEach((item) => {
      const a = document.createElement("a");
      a.classList.add(
        "singleChannel",
        "list-group-item",
        "list-group-item-action"
      );
      // list-group-item.style.margin = "5px";
      a.setAttribute("data-channel", item);
      a.innerHTML = item;
      document.querySelector("#channelList").append(a);
    });

    socket.on("alert message", (data) => {
      document.getElementById("alertMessage").textContent = data.message;
      $("#alertSystem").fadeTo(1, 1).show();
      setTimeout(function () {
        $("#alertSystem")
          .fadeTo(500, 0)
          .slideUp(500, function () {
            $(this).hide();
          });
      }, 3000);
    });

    socket.on("alert join", (data) => {
      document.getElementById("alertJoin").textContent =
        data.user + " " + data.message;
      $("#JoinSystem").fadeTo(1, 1).show();
      setTimeout(function () {
        $("#JoinSystem")
          .fadeTo(500, 0)
          .slideUp(500, function () {
            $(this).hide();
          });
      }, 3000);
    });

    // Listens for clicks in each channel in channel list and sends a join signal to server if clicked
    document.querySelectorAll(".singleChannel").forEach((channel) => {
      if (channel.querySelector("active") == null) {
        // Active channel does not exist
        const storedChannel = localStorage.getItem("channel");
        const currentChannel = document.querySelector(
          `[data-channel=${CSS.escape(storedChannel)}]`
        );
        currentChannel.classList.add("active");
      }

      channel.onclick = () => {
        // Removes previous channel with active class
        const remove = document.querySelectorAll(".singleChannel");
        remove.forEach((item) => {
          item.classList.remove("active");
        });
        // Gets data attribute and selects corresponding element, adding class ative to it
        const selectedChannel = channel.getAttribute("data-channel");
        const activeChannel = document.querySelector(
          `[data-channel=${CSS.escape(selectedChannel)}]`
        );
        activeChannel.classList.add("active");
        // Sends time and channel data to server to join room
        let currentTime = new Date().toLocaleString();
        const currentChannel = localStorage.getItem("channel");
        const user = localStorage.getItem("username");
        document.querySelector("#messagesList").innerHTML = "";
        socket.emit("join channel", {
          selectedChannel: selectedChannel,
          currentTime: currentTime,
          currentChannel: currentChannel,
          user: user,
        });
        localStorage.setItem("channel", selectedChannel);
      };
    });
  });

  // Do no let empty inputs being posted
  validInput("#submitChannel", "#channelName");
  // Listens for channel name submissions on click
  document.getElementById("submitChannel").onclick = () => {
    const channelName = document.getElementById("channelName");
    socket.emit("submit channel", { channelName: channelName.value });
    channelName.value = "";
  };

  // Listens for channel name submissions on enter key
  document.getElementById("channelName").addEventListener("keyup", (e) => {
    if (e.keyCode === 13) {
      const channelName = document.getElementById("channelName");
      if (channelName.value.length > 0) {
        socket.emit("submit channel", { channelName: channelName.value });
        channelName.value = "";
      }
    }
  });

  // Listens for clicks on logout button
  document.getElementById("logoutLink").onclick = logout;

  // Sends to server message, channel and time data
  function sendMessage(message, channel) {
    let time = new Date().toLocaleString();
    let user = localStorage.getItem("username");
    socket.emit("receive message", {
      messageField: message,
      currentChannel: channel,
      currentTime: time,
      user: user,
    });
    message.value = "";
  }

  // For activating login modal
  function login() {
    // If no channel is stored locally, create one
    if (!localStorage.getItem("channel"))
      localStorage.setItem("channel", "General");

    // List channels
    socket.emit("available channels");

    // Get user name
    let userExists = localStorage.getItem("username");
    if (!userExists) {
      // Shows pop-up dialog for prompting display name
      $("#userModal").modal({ backdrop: "static", keyboard: false });

      // Do no let empty inputs being posted
      validInput("#submitName", "#displayName");

      // When form is submitted, creates request
      document.querySelector("#submitName").onclick = () => {
        const username = document.querySelector("#displayName");
        localStorage.setItem("username", username.value);
        username.value = "";
        logUserData();
        $("#userModal").modal("hide");
      };

      document.querySelector("#displayName").addEventListener("keyup", (e) => {
        if (e.keyCode === 13) {
          if (displayName.value.length > 0) {
            const username = document.querySelector("#displayName");
            localStorage.setItem("username", username.value);
            username.value = "";
            logUserData();
            $("#userModal").modal("hide");
          }
        }
      });
    } else {
      // Already logged
      logUserData();
    }
  }

  function logUserData() {
    // Logging in
    const currentChannel = localStorage.getItem("channel");
    const currentTime = new Date().toLocaleString();
    const user = localStorage.getItem("username");
    const message = (document.getElementById("welcome").textContent = user);
    socket.emit("join channel", {
      currentChannel: currentChannel,
      currentTime: currentTime,
      selectedChannel: "empty",
      user: user,
    });
    document.getElementById("welcome").innerHTML = currentChannel;
    document.getElementById("crtuser").innerHTML = user
      .substring(0, 1)
      .toUpperCase();
  }

  // Displays username in navbar
  function createUserNav(user) {
    // Welcome message
    document.getElementById("welcome").append(user);
  }

  // Deletes username data in local storage
  function logout() {
    // Sends log off message
    const channel = localStorage.getItem("channel");
    const message = "logged off";
    sendMessage(message, channel);
    // Deleting user  data
    localStorage.clear();
    document.getElementById("welcome").innerHTML = "";
    document.querySelector("#channelList").innerHTML = "";
    document.querySelector("#messagesList").innerHTML = "";
    login();
  }

  // Prevents empty inputs being sent in prompts.
  // Input = response from user, button = element that triggers submission
  function validInput(button, input) {
    // Disables submit button by default
    document.querySelector(button).disabled = true;

    // Enables submit button only if user typed something on display name input field
    document.querySelector(input).onkeyup = () => {
      if (document.querySelector(input).value.length > 0) {
        document.querySelector(button).disabled = false;
      } else {
        document.querySelector(button).disabled = true;
      }
    };
  }
});
