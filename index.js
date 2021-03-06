const crypto = require('crypto-js');
const https = require('https');

exports.handler = async (event, context, callback) => {
  // our variables
  const id = event.data
  const access_key = process.env.accessKeyID; // TODO: Change to process.env.accessKeyID
  const secret_key = process.env.secretKey; // TODO: Change to process.env.secretKey
  const region = 'us-east-1';
  const url = 'apigateway.'+ region + '.amazonaws.com';
  const myService = 'apigateway';
  const myMethod = 'GET';
  const myPath = '/apikeys/' + id + '/';
  // get the various date formats needed to form our request
  var amzDate = await getAmzDate(new Date().toISOString());
  var authDate = amzDate.split("T")[0];
 
  // we have an empty payload here because it is a GET request
  var payload = '';
  // get the SHA256 hash value for our payload
  var hashedPayload = crypto.SHA256(payload).toString();
 
  // create our canonical request
  var canonicalReq =  myMethod + '\n' +
                      myPath + '\n' +
                      '\n' +
                      'host:' + url + '\n' +
                      'x-amz-content-sha256:' + hashedPayload + '\n' +
                      'x-amz-date:' + amzDate + '\n' +
                      '\n' +
                      'host;x-amz-content-sha256;x-amz-date' + '\n' +
                      hashedPayload;
 
  // hash the canonical request
  var canonicalReqHash = crypto.SHA256(canonicalReq).toString();
 
  // form our String-to-Sign
  var stringToSign =  'AWS4-HMAC-SHA256\n' +
                      amzDate + '\n' +
                      authDate+'/'+region+'/'+myService+'/aws4_request\n'+
                      canonicalReqHash;
 
  // get our Signing Key
  var signingKey = await getSignatureKey(crypto, secret_key, authDate, region, myService);
 
  // Sign our String-to-Sign with our Signing Key
  var authKey = await crypto.HmacSHA256(stringToSign, signingKey);
 
  // Form our authorization header
  var authString  = 'AWS4-HMAC-SHA256 ' +
                    'Credential='+
                    access_key+'/'+
                    authDate+'/'+
                    region+'/'+
                    myService+'/aws4_request,'+
                    'SignedHeaders=host;x-amz-content-sha256;x-amz-date,'+
                    'Signature='+authKey;
 
  // throw our headers together
  const headers = {
    'Authorization' : authString,
    'Host' : url,
    'x-amz-date' : amzDate,
    'x-amz-content-sha256' : hashedPayload
  };

  // call our function
  

  const outputName = await performRequest(url, headers, payload, myPath, async function(response) {
    return JSON.parse(response).name;
  });
  if(outputName!= undefined) {
    return({
      statusCode: 200,
    	input: id,
      headers: {
    		'Access-Control-Allow-Origin': '*'
    	},
    	body: {
    		success: true, name: await outputName
    	}
    });
  } else {
    return({
      statusCode: 200,
    	input: id,
      headers: {
    		'Access-Control-Allow-Origin': '*'
    	},
    	body: {
    		success: false
    	}
    });
  }
  

}

// the REST API call using the Node.js 'https' module
async function performRequest (endpoint, headers, data, thispath, success) {
  return new Promise((resolve, reject) => {
    var dataString = data;
 
    var options = {
      host: endpoint,
      port: 443,
      path: thispath,
      method: 'GET',
      headers: headers
    };
   
    var req = https.request(options, function(res) {
      res.setEncoding('utf-8');
   
      var responseString = '';
      res.on('data', function(data) {
        responseString += data;
      });
   
      res.on('end', function() {
        resolve(JSON.parse(responseString).name);
      });
    });
 
    req.write(dataString);
    req.end();
  });
}
// this function converts the generic JS ISO8601 date format to the specific format the AWS API wants
async function getAmzDate(dateStr) {
  var chars = [":","-"];
  for (var i=0;i<chars.length;i++) {
    while (dateStr.indexOf(chars[i]) != -1) {
      dateStr = dateStr.replace(chars[i],"");
    }
  }
  dateStr = dateStr.split(".")[0] + "Z";
  return dateStr;
}

// this function gets the Signature Key, see AWS documentation for more details, this was taken from the AWS samples site
async function getSignatureKey(Crypto, key, dateStamp, regionName, serviceName) {
  var kDate = Crypto.HmacSHA256(dateStamp, "AWS4" + key);
  var kRegion = Crypto.HmacSHA256(regionName, kDate);
  var kService = Crypto.HmacSHA256(serviceName, kRegion);
  var kSigning = Crypto.HmacSHA256("aws4_request", kService);
  return kSigning;
}
