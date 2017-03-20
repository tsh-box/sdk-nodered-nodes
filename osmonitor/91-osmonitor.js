module.exports = function(RED) {

    "use strict";
    var request = require('request');
    var moment = require('moment');
    var databox = require('node-databox');
    var url = require("url");

    function testing(node, n){

        const API_URL  = `${process.env.MOCK_DATA_SOURCE}/reading/latest`;

        const options = {
            method: 'post',
            body: {sensor_id: n.subtype},
            json: true,
            url: API_URL,
        }
        
        const periodic = setInterval(function(){
                    request(options, function (err, res, body) {
                        if (err) {
                            console.log(err, 'error posting json')
                        }else{
                            if (body.length > 0){
                                const result = body[0];
                                if (result.length > 0){
                                    const {time,value} = result[0];
                                    
                                    console.log({
                                            name: n.name || "osmonitor",
                                            id:  n.id,
                                            subtype: n.subtype,
                                            type: "osmonitor",
                                            payload: {
                                                ts: moment.utc(time).unix(),
                                                value: Number(value), 
                                            },
                                    });
                                    
                                    node.send({
                                            name: n.name || "osmonitor",
                                            id:  n.id,
                                            subtype: n.subtype,
                                            type: "osmonitor",
                                            payload: {
                                                ts: moment.utc(time).unix(),
                                                value: Number(value), 
                                            },
                                    });   
                                }
                            }   
                        }
                    });
        }, 3000);


        node.on("close", function() {
            console.log(`${node.id} stopping requests`);
            clearInterval(periodic);
        });
    }

    function OSMonitor(n) {
        
        RED.nodes.createNode(this,n);
        
        if (process.env.TESTING){
            return testing(this, n);
        }

        var periodic;
        const  API_ENDPOINT = JSON.parse(process.env[`DATASOURCE_${n.id}`] || '{}');
        const  HREF_ENDPOINT = API_ENDPOINT.href || ''; 
        console.log(`API_ENDPOINT: ${API_ENDPOINT}`);
        console.log(`HREF_ENDPOINT: ${HREF_ENDPOINT}`);

        this.name = n.name; 
        var node = this;

        new Promise((resolve,reject)=>{
                setTimeout(resolve,10000);
        }).then(()=>{
            var dataEmitter = null; 
            
            if (HREF_ENDPOINT != ''){

               
                var endpointUrl = url.parse(HREF_ENDPOINT);
                var dsID = API_ENDPOINT['item-metadata'].filter((itm)=>{return itm.rel === 'urn:X-databox:rels:hasDatasourceid'; })[0].val;
                var dsUrl = endpointUrl.protocol + '//' + endpointUrl.host;
                var dsType = API_ENDPOINT['item-metadata'].filter((itm)=>{return itm.rel === 'urn:X-databox:rels:hasType';})[0].val;
                
                console.log(`dsID:${dsID} dsUrl:${dsUrl} dsType${dsType}`);
                //pull out the latest....

                periodic = setInterval(function(){
                    databox.timeseries.latest(dsUrl, dsID)
                    .then((data)=>{
                         console.log("sending data");
                         console.log(data[0].data);
                         node.send({
                            name: n.name || "osmonitor",
                            id:  n.id,
                            subtype: n.subtype,
                            type: "osmonitor",
                            payload: {
                                ts: Date.now(),
                                value: data[0].data, 
                            },
                        });   
                    })
                    .catch((err)=>{
                        console.log("[Error getting timeseries.latest]",dsUrl, dsID);
                    });
                }, 3000);

                //subscribe - this doesn't work at the mo!
                /*databox.subscriptions.connect(HREF_ENDPOINT)
                .then((emitter)=>{
                    dataEmitter = emitter;
                    var endpointUrl = url.parse(HREF_ENDPOINT);
                    var dsID = API_ENDPOINT['item-metadata'].filter((itm)=>{return itm.rel === 'urn:X-databox:rels:hasDatasourceid'; })[0].val;
                    var dsUrl = endpointUrl.protocol + '//' + endpointUrl.host;
                    console.log("[subscribing]",dsUrl,dsID);
                    databox.subscriptions.subscribe(dsUrl,dsID,'ts').catch((err)=>{console.log("[ERROR subscribing]",err)});
                    
                    dataEmitter.on('data',(hostname, dsID, data)=>{
                        console.log(hostname, dsID, data);
                        node.send({
                            name: n.name || "osmonitor",
                            id:  n.id,
                            subtype: n.subtype,
                            type: "osmonitor",
                            payload: {
                                ts: Date.now(),
                                value: data, 
                            },
                        });   
                    });

                    dataEmitter.on('error',(error)=>{
                        console.log(error);
                    });
                
                }).catch((err)=>{console.log("[Error] connecting ws endpoint ",err);});*/
            }
        });

        this.on("close", function() {
            console.log(`${node.id} stopping requests`);
            clearInterval(periodic);
        });
       
    }

    // Register the node by name. This must be called beforeoverriding any of the
    // Node functions.
    RED.nodes.registerType("osmonitor",OSMonitor);

}
