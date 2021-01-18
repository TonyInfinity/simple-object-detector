const express = require("express");
const path = require("path");
const AWS = require("aws-sdk");
const cors = require("cors");
const { createCanvas, loadImage } = require("canvas");
const fileUpload = require("express-fileupload");

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload());

const awsRegion = process.env.AWS_REGION;
const bucket = process.env.BUCKET;
const localFolderPath = process.env.LOCAL_FOLDER_PATH;
var photo = "";
const imgWidth = 1920;
const imgHeight = 1080;
const boxColor = "#FFFF00";
const nameColor = "#FF0000";
const nameStyle = "bold 20pt Menlo";
const maxLabels = 10;
const minConfidence = 90;
const canvas = createCanvas(imgWidth, imgHeight);
const ctx = canvas.getContext("2d");

AWS.config.update({
  region: awsRegion,
});

app.use(express.static(path.join(__dirname, "static")));

app.post("/upload", (req, res) => {
  photo = req.files.photo.name;
  const s3 = new AWS.S3();
  const s3Params = {
    Bucket: bucket,
    Key: req.files.photo.name,
    Body: req.files.photo.data,
  };
  s3.upload(s3Params, (err, data) => {
    if (err) {
      throw err;
    }
    res.redirect("/analyzed");
  });
});

app.get("/analyzed", (req, res) => {
  const rekognition = new AWS.Rekognition();
  var detectLabelsParams = {
    Image: {
      S3Object: {
        Bucket: bucket,
        Name: photo,
      },
    },
    MaxLabels: maxLabels,
    MinConfidence: minConfidence,
  };
  rekognition.detectLabels(detectLabelsParams, (error, response) => {
    if (error) {
      console.log(error, error.stack);
    } else {
      loadImage(localFolderPath + photo).then((image) => {
        ctx.drawImage(image, 0, 0, imgWidth, imgHeight);
        ctx.beginPath();
        response["Labels"].forEach((label) => {
          const names = [];
          names.push(label.Name);
          label["Instances"].forEach((instance) => {
            topCord = instance.BoundingBox.Top * imgHeight;
            leftCord = instance.BoundingBox.Left * imgWidth;
            boxWidth = instance.BoundingBox.Width * imgWidth;
            boxHeight = instance.BoundingBox.Height * imgHeight;
            ctx.rect(leftCord, topCord, boxWidth, boxHeight);
            ctx.lineWidth = 2;
            ctx.strokeStyle = boxColor;
            ctx.stroke();
            ctx.fillStyle = nameColor;
            ctx.font = nameStyle;
            ctx.fillText(names, leftCord, topCord - 5);
          });
        });

        res.send(
          `<div><h4>Here's what we detected 🔎</h4><div style="display:grid;height:80vh;border: 3px dashed blue"><img src="${canvas.toDataURL()}" style="max-width:100%;max-height:80vh;margin:auto;border: 3x dashed red" /></div></div>`
        );
      });
    }
  });
});
app.listen(PORT);
