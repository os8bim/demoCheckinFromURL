const SERVER_ADDRESS = "http://localhost:8082"
const USERNAME = "bim@888sp.it"
const PASSWORD = "bim"

const client = new bimserverapi.BimServerClient(SERVER_ADDRESS)

const btnLoad = document.getElementById("btn-load")
btnLoad.addEventListener("click", () => {
    onClientReady()
})

const projectName = `${document.getElementById("txt-project-name").value}-${new Date().getTime()}`,
    projectSchema = document.getElementById("txt-project-schema").value,
    filePath = document.getElementById("txt-project-filepath").value,
    comment = document.getElementById("txt-project-comment").value

client.callPromise = function(service, method, params) {
    return new Promise((resolve, reject) => {
        this.call(
            service,
            method,
            params,
            data => {
                resolve(data)
            },
            err => {
                console.error(err)
                reject(err)
            }
        )
    })
}

const deserializers = new Map()

client.init().then(() => {
    client.login(
        USERNAME,
        PASSWORD,
        () => {
            getSuggestedDeserializerOidForSchema("ifc2x3tc1")
                .then(oid => {
                    deserializers.set("ifc2x3tc1", oid)
                    getSuggestedDeserializerOidForSchema("ifc4")
                })
                .then(oid => {
                    deserializers.set("ifc4", oid)
                    btnLoad.disabled = false
                })
        },
        () => {
            alert(`Can't login. Server: ${SERVER_ADDRESS}. Username: ${USERNAME}. Password: ${PASSWORD}`)
        }
    )
})

function getSuggestedDeserializerOidForSchema(ifcSchema) {
    let name = ifcSchema === "ifc2x3tc1" ? "Ifc2x3tc1 (Streaming)" : "Ifc4 (Streaming)"
    return new Promise((resolve, reject) => {
        client.call(
            "ServiceInterface",
            "getDeserializerByName",
            {
                deserializerName: name
            },
            function(deserializer) {
                console.log("Deserializer", deserializer)
                resolve(deserializer.oid)
            },
            function(error) {
                console.error(error)
                reject(error)
            }
        )
    })
}

function onClientReady() {
    console.log(filePath)

    let fileName = filePath.substring(filePath.lastIndexOf("/") + 1)
    console.log("fileName", fileName)

    client
        .callPromise("ServiceInterface", "addProject", {
            projectName: projectName,
            schema: projectSchema
        })
        .then(project => {
            console.log(`Creato progetto ${projectName}`)
            return project
        })
        .then(project => {
            console.log("Inzio checkinFromUrl", project, deserializers.get(projectSchema))
            return client.callPromise("ServiceInterface", "checkinFromUrlAsync", {
                deserializerOid: deserializers.get(projectSchema),
                comment: comment,
                merge: false,
                poid: project.oid,
                url: filePath,
                sync: false,
                fileName: fileName
            })
        })
        .then(topicId => {
            console.log("Checkin avviato")
            client.registerProgressHandler(topicId, (topicId, state) => {
                console.log(`Topic ${topicId} - Progress!`, state)
                if (state.state === "FINISHED") {
                    let timestamp = state.start

                    // let fullFileName = Utils.getFullFileName(fileName, timestamp)

                    console.log(`Caricamento del progetto ${fileName}-${timestamp} completato`)

                    client.callWithNoIndication(
                        "ServiceInterface",
                        "cleanupLongAction",
                        {
                            topicId: topicId
                        },
                        function() {}
                    )
                    // .done(
                    //     function() {
                    //         // This also automatically unregisters the progress handler,
                    //         // so we only have to tell bimserverapi that it's unregistered
                    //         this.bimServerApi.unregister() // TODO: rimuovere il progress-handler
                    //     }.bind(this)
                    // )
                } else if (state.state == "STARTED" || state.state == "NONE") {
                }
            })
        })
}
