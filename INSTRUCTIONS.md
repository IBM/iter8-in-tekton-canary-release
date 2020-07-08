# Instructions

The materials and instructions provided are for a Red Hat OpenShift Container Platform (OCP) version 4.3 environment, and will install Iter8 v0.1.1, Tekton pipelines v0.12.1, Tekton Triggers v0.4.0 and make use of Helm v3.1.2.  If you wish to use different levels of software you may need to deviate from these instructions.

**1. Log into your cluster's API server**

```
  $ oc login --token=<YOUR_TOKEN> --server=<YOUR_CLUSTER_API_SERVER>
```

**2.  Create the istio, iter8, tekton-pipelines and iter8-demo-project namespaces**

```
  $ oc create ns istio-system
  $ oc create ns iter8
  $ oc create ns tekton-pipelines
  $ oc create ns iter8-demo-project
```

**3. Install Red Hat OpenShift Service Mesh Operator**

The Red Hat Service Mesh Operator has a number of prerequisite's that need to be installed.  The notes below are extracts from the instructions for installing the Red Hat OpenShift Service Mesh Operator and include prerequisite instructions.

	- Install the Elasticsearch Operator

		- In the OCP console navigate to Operators -> Operator Hub
		- In the filter box enter elasticsearch
		- Click on the Elasticsearch Operator provided by Red Hat, inc
		- Click Install
		- Ensure Update Channel is set to 4.3
		- Click Subscribe

	- Install the Jaeger Operator

		- In the OCP console navigate to Operators -> Operator Hub
		- In the filter box enter jaeger
		- Click on the Red Hat OpenShift Jaeger option from the results
		- Click Install
		- Click Subscribe

	- Install the Kiali Operator

		- In the OCP console navigate to Operators -> Operator Hub
		- In the filter box enter kiali
		- Click on the Kiali Operator provided by Red Hat
		- Click Install
		- Click Subscribe

	- Install the Red Hat OpenShift Service Mesh Operator Operator

		- In the OCP console navigate to Operators -> Operator Hub
		- In the filter box enter red hat openshift service mesh
		- Click on the Red Hat OpenShift Service Mesh Operator
		- Click Install
		- Click Subscribe  

  - In the Operators -> Installed Operators view, select openshift-operators from the project drop down at the top of the center panel
  - You should see the four operators listed with a status of succeeded as per the screen shot below

![Installed Operators](./images/operators.png?raw=true "Post Install View Of Operators Panel")


**4. Deploy the Red Hat OpenShift Service Mesh Control Plane**

  - In the Operators -> Installed Operators view, select istio-system from the project dropdown
  - You should see the four operators listed in this view but might have to wait a couple of minutes whilst they install into the istio-system namespace
  - Click the Red Hat OpenShift Service Mesh Operator
  - Under Istio Service Mesh Control Plane click Create ServiceMeshControlPlane/Create Instance
  - Click Create to create the control plane
  - You should now see a number of pods starting in the istio-system namespace, it may take a few minutes for all the pods to come up but you should see output similar to:

```
  $ oc get pods -n istio-system

  NAME                                      READY   STATUS    RESTARTS   AGE
  grafana-8459577f8d-2tds6                  2/2     Running   0          6m30s
  istio-citadel-6784798885-64cvc            1/1     Running   0          15m
  istio-egressgateway-b8d7d6fcf-mp9zz       1/1     Running   0          7m54s
  istio-galley-7549bb654b-k9dh7             1/1     Running   0          11m
  istio-ingressgateway-7f6fcf4bc9-9vgtt     1/1     Running   0          7m53s
  istio-pilot-75d4fdb54f-85fwf              2/2     Running   0          7m54s
  istio-policy-7cb97db7c8-lt9rv             2/2     Running   0          10m
  istio-sidecar-injector-866fccd4d9-h5w4s   1/1     Running   0          6m52s
  istio-telemetry-6585f4479c-bt9rf          2/2     Running   0          10m
  jaeger-86875b4ff7-qglsq                   2/2     Running   0          11m
  kiali-d4df7678b-dzfgd                     1/1     Running   0          5m27s
  prometheus-6fd94bf66b-zfzdn               2/2     Running   0          14m
```

**5. Configure the Service Mesh Member Roll**

  - In the Operators -> Installed Operators view, select istio-system from the project dropdown
  - You should see the four operators listed in this view but might have to wait a couple of minutes whilst they install into the istio-system namespace
  - Click the Red Hat OpenShift Service Mesh Operator
  - Click the All Instances tab
  - From the Create New button dropdown, select Istio Service Mesh Member Roll
  - Edit the member listing to include iter8-demo-project, such that the yaml matches the below:

```
	apiVersion: maistra.io/v1
	kind: ServiceMeshMemberRoll
	metadata:
	name: default
	namespace: istio-system
	spec:
	members:
	  - iter8-demo-project
```

  - Click Create


**6. Install Iter8 v0.1.1**

The notes below are extracts from the instructions for installing Iter8.

  - Download and extract the analytics helm chart

```
  $ wget https://github.com/iter8-tools/iter8-analytics/releases/download/v0.1.1/iter8-analytics-helm-chart.tar
  $ tar -xvf iter8-analytics-helm-chart.tar
```

  - Obtain the prometheus password by running 

```
  $ oc -n istio-system get cm kiali -o yaml | grep -m 1 password: | tr -d '[:space:]' | cut -f 2 -d ":"
```

  - Edit the iter8-analytics/values.yaml file, updating the metricsBackend settings from

```
        metricsBackend:
          url: "http://prometheus.istio-system:9090"
          authentication:
            type: "none"
            username: ""
            password: ""
            insecure_skip_verify: false
```

to the following (it is easy to miss changing http to https, so pay attention!)

```
        metricsBackend:
          url: "https://prometheus.istio-system:9090"
          authentication:
            type: "basic"
            username: "internal"
            password: "YOUR_PASSWORD_HERE"
            insecure_skip_verify: true
```

  - Install Iter8 by running the following commands (note: I used helm v3.1.2):

```
  $ helm template iter8-analytics | oc apply -f -
  $ oc apply -f https://raw.githubusercontent.com/iter8-tools/iter8-controller/v0.1.1/install/iter8-controller.yaml
```

  - You might see a warning as below, you can safely ignore this for now.

```
  Warning: oc apply should be used on resource created by either oc create --save-config or oc apply
```

  - You should now see pods running in the iter8 namespace similar to the output below:

```
  $ oc get pods -n iter8

  NAME                                  READY   STATUS    RESTARTS   AGE
  controller-manager-5647f49659-q8tvc   1/1     Running   0          34s
  iter8-analytics-575df575d7-25x6m      1/1     Running   0          51s
```

With Iter8 now installed, we can look at importing Iter8's Grafana dashboard, to do so we need to log in to the Grafana dashboard and then importing the yaml.

  - Obtain the Grafana URL by running the following command:

```
  $ kubectl get route grafana -n istio-system
```

  - Navigate in a browser to the Host/Port as reported in the output from the command above, note that you may need to add a https:// prefix
  - Login using your kube admin credentials and accept any required permission requests
  - Once logged in, navigate to the "+" icon on the left menu and select import

![Import Menu](./images/import.png?raw=true "View Of Grafana Showing Import Option")

  - Copy all the json from https://raw.githubusercontent.com/iter8-tools/iter8-controller/v0.1.1/config/grafana/istio.json
  - Paste the json into box in the Grafana dashboard labelled "Or paste JSON"
  - Click Load
  - Click Import

this should result in a view similar to:

![Iter8 Dashboard In Grafana](./images/post-import.png?raw=true "View Of Iter8 Dashboard In Grafana")


**7. Install Tekton**

The notes below are extracts from the instructions for installing Tekton Pipelines and Tekton Triggers.

```
  $ oc project tekton-pipelines 
  $ oc adm policy add-scc-to-user anyuid -z tekton-pipelines-controller 
  $ oc apply --filename https://storage.googleapis.com/tekton-releases/pipeline/previous/v0.12.1/release.notags.yaml
  $ oc apply --filename https://storage.googleapis.com/tekton-releases/triggers/previous/v0.4.0/release.yaml
  $ oc get pods -n tekton-pipelines
```

You should now be looking at a number of running pods similar to the listing below:

```
  NAME                                           READY   STATUS    RESTARTS   AGE
  tekton-pipelines-controller-865697dd96-2fhcp   1/1     Running   0          66s
  tekton-pipelines-webhook-69bbf98fdc-n52pv      1/1     Running   0          61s
  tekton-triggers-controller-f7f784cf4-6gtnm     1/1     Running   0          28s
  tekton-triggers-webhook-df87c848c-4crt8        1/1     Running   0          20s
```

Note: 

Tekton requires some persistent storage to be available for the pipelines to function - providing backing storage for inputs and outputs to Tasks (see https://github.com/tektoncd/pipeline/blob/master/docs/install.md#configuring-artifact-storage).  I have configured NFS for dynamic provisioning on my cluster but you can use whatever best suits your environment and as such this task is left as an exercise for the reader.


**8. Clone The GitOps Sample Repository And Create An Access Token**

You now need to clone the sample GitOps repository onto your git server and create an access token. 

Cloning your own version of the repository might be as simple as forking the repository or cloning locally and pushing up to your git server.  The GitOps repositroy to clone is https://github.com/IBM/iter8-demo-gitops-repo

After cloning this repo and pushing into your own GitHub server location, create an access token in GitHub/GitHub Enterprise by:

  - click on your profile icon in the top right corner
  - select developer settings -> personal access tokens
  - click the `Generate new token` button and give your token a name
  - tick the `repo` checkbox to give the access token access to your repositories
  - click `Generate token`
  - copy the token and store it somewhere safe


**9. Install and Configure Your Tekton Resources and Initial Application**

Add additional priviledges to the default service account in our iter8-demo-project namespace by running:

```
  $ oc adm policy add-scc-to-user anyuid -z default -n iter8-demo-project
```

Next, you need to clone this repository locally

```
  $ git clone https://github.com/IBM/iter8-in-tekton-canary-release.git
  $ cd iter8-in-tekton-canary-release
```

We now need to build the different microservice that will be used and push them to a docker registry.  After ensuring you are logged into your docker registry, you can simply run the provided build_and_push script.

```
  $ ./scripts/build_and_push.sh YOUR_REGISTRY
```

If you are using your dockerhub account this would simply be: `./scripts/build_and_push.sh YOUR_DOCKERHUB_ID`  

After the microservices are built and pushed into your registry you now need to make a number of edits to the initial configuration files, starting by editing the `config/100-init.yaml` file, replacing:

  - `YOUR_REGISTRY` in two places with the same value supplied to the build_and_push script previously run.

Next edit the `config/100-user-secrets-and-binding.yaml` file, replacing:

  - `YOUR_TOKEN_HERE` in two places with the access token previously created.
  - `YOUR_GIT_SERVER` with the url of your git server e.g. `https://github.myorg.com`
  - `YOUR_GIT_SERVER_NO_PROTOCOL` with the same value but without the protocol e.g. `github.myorg.com`
  - `YOUR_API_PATH_PREFIX` with the path prefix to reach your GitHub API server, this is typically `/api/v3` on GitHub enterprise

Once finished, apply all the required resources to your cluster:

```
  $ oc apply -f ./config
  $ oc apply -f https://raw.githubusercontent.com/tektoncd/catalog/master/github/set_status.yaml -n tekton-pipelines
```

At this point you should now be able to access the test application.  Looking at the running pods in the iter8-demo-project namespace you should see 2 pods running similar to below:

```
  $ oc get pods -n iter8-demo-project

    NAME                                READY   STATUS    RESTARTS   AGE
    front-66dcc89c8f-4ks5v              2/2     Running   0          43m
    iter8-demo-1.0.0-854776d996-4zlbl   2/2     Running   0          11m
```

To access the application you will need to go via the istio-ingressgateway and the /demo context root, for a typical installation this means you should be able to run:

```
  $ oc get route istio-ingressgateway -n istio-system
```

and then curl the host at the /demo context root

```
  $ curl YOUR-ISTIO-INGRESS-GATEWAY/demo
```

receiving the response:

```
  v1.0.0 thinks for 100 miliseconds!!
```


**10. Create A Webhook**

We now need to create a webhook on our GitOps repository to trigger the pipeline when code is pushed to the repository. 

  - Open your GitOps repository in a browser
  - Click on `Settings`
  - Click on `Webhooks` (This might be labelled `Hooks` on GitHub enterprise)
  - Click `Add webhook`

The webhook needs to talk the the Tekton eventlistener which has been exposed as on openshift route.  To find the `Host/Port` simply run:

```
  $ oc get route iter8-demo -n tekton-pipelines

  NAME         HOST/PORT                                                       PATH   SERVICES                PORT            TERMINATION   WILDCARD
  iter8-demo   iter8-demo-tekton-pipelines.apps.YOUR-DOMAIN                           el-demo-eventlistener   http-listener                 None
```

  - In the `Payload URL` enter the HOST/PORT of the route (remember to prefix it with http://)
  - Set the `Content type` drop down to `application/json`
  - Click `Add webhook`

You are now setup and ready to trigger the [experiments](EXPERIMENTS.md).
