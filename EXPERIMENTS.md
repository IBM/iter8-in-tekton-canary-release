# Running the Automated Canary Pipeline Tutorial

You should already have followed the main [instructions](./INSTRUCTIONS.md) to setup your cluster with the necessary resources and pre-conditions prior to following the steps detailed further below.

The application currently deployed contains a simple wait statement prior to the response being sent from the backend microservice.  The v100 version of the backend currently deployed has a 100 millisecond sleep.  The first update we will do is to deploy v101 which contains a longer wait of 300 milliseconds and then we will make another update to deploy v102 which contains a 50 millisecond sleep.

The experiment we setup within the create-experiment-task `Task` will require that the application is responding on average within 200 milliseconds, thus our first experiment with v101 should fail and leave our original v100 microservice running, whilst the v102 experiment should be successful and result in the v100 deployment being removed.

The front end application source code can be found at [here](./frontend), whilst the backend service can be found [here](./backend).

## Update Operation 1

**1. Modify the Iter8 pipeline properties and update the deploy.yaml**

Assuming you are currently in your local clone of the gitops-repo we will now perform some modifications to the application and the pipeline properties we want to use to access our application.  

  - Edit `iter8/pipeline.prop` and replace `YOUR-ISTIO-INGRESS-GATEWAY-HERE` with the value previously used to test the application, you obtained it by running:

```
  $ oc get route istio-ingressgateway -n istio-system
```

  - Edit `config/deploy.yaml` and edit the four occurences of `v100` to `v101`
  - Modify `YOUR_REGISTRY`, such that the image is being pulled from the docker registry you specified when running the build_and_push.sh script
  
  Your file should now be similar to the one below (but with `foobar` being your registry):

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iter8-demo-v101
  labels:
    app: demo
    version: v101
spec:
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      annotations:
        sidecar.istio.io/inject: "true"
      labels:
        app: demo
        version: v101
    spec:
      containers:
      - name: demo
        image: foobar/iter8-demo:v101
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
```

  Notes:
  
  These properties in the iter8/pipeline.prop file could have been specified elsewhere as properties for our pipeline but were intentionally placed in this file to enable a better understanding of settings in use and their realtion to the setup.

  I appreciate this is a very simplistic repository and may not represent a real world git-ops repository but it is intended to be as simplistic as possible to aid understanding.

**2. Push the Updates to Git and Monitor Grafana**

At this point you will probably want:

  - A terminal open running `watch oc get pods -n tekton-pipelines`
  - A terminal open running `watch oc get experiments -n iter8-demo-project`
  - A terminal open running `watch oc get pods -n iter8-demo-project`

Note: If you do not have watch installed and available, you should be able to add `-w` to any `oc get pods` command, or simply re run the command every few seconds excluding the `watch` prefix.  Alternatively you could see the progress of the pipeline by using the OCP console, navigate to `Pipelines` -> `Pipeline  Runs` and select `tekton-pipelines` from the `Project` dropdown at the top of the page.

  - A browser window with the grafana Iter8 dashboard view open, it should look like the image below:

![Iter8 Dashboard In Grafana](./images/post-import.png?raw=true "View Of Iter8 Dashboard In Grafana")


We now want to commit our changes and push them to our git repository:

```
  $ git add *
  $ git commit -m "upgrade deployment to v101"
  $ git push
```

The following chain of events now occurs:

  - GitHub webhook sends event to Tekton eventlistener
  - Eventlistener creates a Tekton pipelinerun to execute our pipeline, with various parameters set from triggerbindings
  - Pods start in the tekton-pipelines namespace executing the steps in our pipeline
  - Load is sent to our application front end via the istio ingress-gateway noted in our prop file
  - An experiment is created in the iter8-demo-project
  - Our new deployment is created and pods start
  - A pod runs which monitors the experiment for completion and removes the relevant deployment depending upon the experiment's success or failure
  - An update is made to the git commit to mark a successful or failed run

At the point the pods for the new deployment are visible in the iter8-demo-project namespace, you will want to:

  - Select the `iter8-demo-project` namespace from the `Namespace` dropdown in your grafana dashboard
  - Select the `iter8-demo` service from the `Service` dropdown
  - Ensure the `Baseline` is set to `iter8-demo-v100` and `iter8-demo-v101` as the `Candidate`

You should now be seeing metrics captured similar to below (note that I have changed the duration from `Last 1 hour` to `Last 15 Minutes` in the top right corner of the grafana dashboard):

![Iter8 Dashboard In Grafana Showing Experiment Metrics](./images/100-101.png?raw=true "View Of Iter8 Dashboard In Grafana")

Note: I have witnessed grafana not update the list of available candidates, if this happens refresh the page and you should see an updated list.

You will see that the v101 candidate has a latency above the 0.2 seconds mark - indicating that our experiment should fail and no extra traffic will be routed to our new deployment as it is stuggling to meet our success criteria with its current load.

View of pods starting for pipeline tasks:

```
  NAME                                                      READY   STATUS            RESTARTS   AGE
  el-demo-eventlistener-7f9d79dc9f-qpldb                    1/1     Running           0          3d20h
  simple-pipeline-run-k2twb-generate-load-8n7d5-pod-bqnhl   0/2     PodInitializing   0          10s
  simple-pipeline-run-k2twb-iter8-92r4v-pod-z5ctd           2/2     Running           0          10s
  tekton-pipelines-controller-68d89c65b5-rtzdh              1/1     Running           0          3d21h
  tekton-pipelines-webhook-68d7f856f-pdbmb                  1/1     Running           0          3d21h
  tekton-triggers-controller-f7f784cf4-qgrzt                1/1     Running           0          3d21h
  tekton-triggers-webhook-df87c848c-dmkjc                   1/1     Running           0          3d21h
```

View of pipeline running in the OCP console:

![OCP Console Pipeline Runs](./images/pipelinerun.png?raw=true "View Of Tekton Pipeline Run in OCP console")


View of pods started for both old and new deployment:

```
  NAME                               READY   STATUS    RESTARTS   AGE
  front-7cb86576b6-rvd5c             2/2     Running   0          3d20h
  iter8-demo-v100-6664868b4c-9jmzn   2/2     Running   0          24m
  iter8-demo-v101-5b954c49c5-x5crg   2/2     Running   0          41s
```

View of experiment commencing:

```
  NAME              PHASE         STATUS                                 BASELINE          PERCENTAGE   CANDIDATE         PERCENTAGE
  iter8-demo-v101   Progressing   IterationUpdate: Iteration 1 Started   iter8-demo-v100   80           iter8-demo-v101   20
```

As new deployment is not responding as required the % of traffic routed is never increased, you can see this on the experiment:

```
  NAME              PHASE         STATUS                                 BASELINE          PERCENTAGE   CANDIDATE         PERCENTAGE
  iter8-demo-v101   Progressing   IterationUpdate: Iteration 3 Started   iter8-demo-v100   80           iter8-demo-v101   20
```

View of the completed failed experiment:

```
  NAME              PHASE       STATUS                                                BASELINE          PERCENTAGE   CANDIDATE         PERCENTAGE
  iter8-demo-v101   Completed   ExperimentFailed: Not All Success Criteria Were Met   iter8-demo-v100   100          iter8-demo-v101   0
```

The new deployment has been removed leaving only the running pod for the original deployment:

```
  NAME                               READY   STATUS    RESTARTS   AGE
  front-7cb86576b6-rvd5c             2/2     Running   0          3d20h
  iter8-demo-v100-6664868b4c-9jmzn   2/2     Running   0          39m
```


## Update Operation 2

In this second update we will update our deploy.yaml to include v102 of the microservice - at this version that responses are within tolerence of the success criteria and we should find our new deployment take over from the old v100 version.

  - Edit config/deploy.yaml and edit the four occurences of `v101` to `v102`, your file should now be as below but with a different `image` location:

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iter8-demo-v102
  labels:
    app: demo
    version: v102
spec:
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      annotations:
        sidecar.istio.io/inject: "true"
      labels:
        app: demo
        version: v102
    spec:
      containers:
      - name: demo
        image: foobar/iter8-demo:v102
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
```

We now want to commit our changes and push them to our git repository:

```
  $ git add *
  $ git commit -m "upgrade deployment to v102"
  $ git push
```

If you monitor this experiment, both using `watch oc get experiments -n iter8-demo-project` and by modifying your grafana dashboard to show the candidate as iter8-demo-102 you should see the following:

  - As each iteration of the experiment progresses a greater percentage of traffic is routed to the new deployment

```
  NAME              PHASE         STATUS                                                BASELINE          PERCENTAGE   CANDIDATE         PERCENTAGE
  iter8-demo-v101   Completed     ExperimentFailed: Not All Success Criteria Were Met   iter8-demo-v100   100          iter8-demo-v101   0
  iter8-demo-v102   Progressing   IterationUpdate: Iteration 3 Started                  iter8-demo-v100   60           iter8-demo-v102   40

  NAME              PHASE         STATUS                                                BASELINE          PERCENTAGE   CANDIDATE         PERCENTAGE
  iter8-demo-v101   Completed     ExperimentFailed: Not All Success Criteria Were Met   iter8-demo-v100   100          iter8-demo-v101   0
  iter8-demo-v102   Progressing   IterationUpdate: Iteration 5 Started                  iter8-demo-v100   20           iter8-demo-v102   80

```

  - In grafana you will see the increase in traffic routed to the new deployment, until the point where all traffic is now routed to v102.  The mean latency view will show the v102 deployment responding in approximatly 0.06 seconds, well below the 0.2 threshold in our success criteria.

![Iter8 Dashboard In Grafana Showing Experiment Metrics](./images/101-102.png?raw=true "View Of Iter8 Dashboard In Grafana")

  - Finally, once completed, you will see your original deployment has been removed and the new v102 deployment up, running and handling all requests.

View of completed experiments:

```
  NAME              PHASE       STATUS                                                BASELINE          PERCENTAGE   CANDIDATE         PERCENTAGE
  iter8-demo-v101   Completed   ExperimentFailed: Not All Success Criteria Were Met   iter8-demo-v100   100          iter8-demo-v101   0
  iter8-demo-v102   Completed   ExperimentSucceeded: All Success Criteria Were Met    iter8-demo-v100   0            iter8-demo-v102   100
```

Running pod for the v100 deployment terminating:

```
  NAME                               READY   STATUS        RESTARTS   AGE
  front-7cb86576b6-rvd5c             2/2     Running       0          3d20h
  iter8-demo-v100-6664868b4c-9jmzn   2/2     Terminating   0          44m
  iter8-demo-v102-547845f75-9xbmz    2/2     Running       0          4m33s
```

You commit history in your GitOps repository will show failure and success status as set via the github-set-status task in our pipeline.

![Commit Status](./images/commit-status.png?raw=true "View Of GitHub commit history showing green tick and red cross")


You could also have viewed the traffic flow changing between the two deployments while the experiment runs through Kiali.  To do so start by finding the kiali web console address by running:

```
  oc get route kiali -n istio-system
```

Navigate to the HOST/PORT listed in the output and login if prompted.  Once logged in, select `Graph` from the left side menu and select the `iter8-demo-project` namespace from the top dropdown.

Select/Add to the default selections by ensuring the following:

  - The graph type is set to `Workload graph`
  - Select `Requests percentage` in the second drop down rather than `No edge labels`
  - On the `Display` options dropdown, add traffic animation

Start another run of the pipeline and when the `Experiment` is progressing you will see an animated flow depicting the route ofthe web traffic, the percentage values indicating relative split of traffic over a time period, rather than exactly matching what the `Experiment` split might be immediately.

![Kiali](./images/kiali.png?raw=true "View Of Experiment in Flight in Kiali")

## Summary

Hopefully you have now seen Iter8 performing automated canary deployments driven from a Tekton pipeline.   

To learn more about Iter8 visit [https://github.com/iter8-tools/docs](https://github.com/iter8-tools/docs) - here you can find more details about the `Experiment` CRD that defines the test strategy and success conditions.

To learn more about the Tekton project and technologies used in this tutorial visit the Tekton GitHub project [here](https://github.com/tektoncd/pipeline#-tekton-pipelines).  We made use of Tekton Triggers to run a pipeline in response to the webhook and for specifics around implementing triggers see the Tekton Triggers sub-project [here](https://github.com/tektoncd/triggers) 

Further details about the Tekton resources used in this tutorial can be found in the TEKTON.md file [here](./TEKTON.md).


## Additional Notes

### Tutorial/Sample Limitations

If an experiment with the same name already exists, running the same experiment again would require a change within the experiment resource.  This means that if you were to change the v101 image and push it to your registry again (with the same v101 tag) you cannot simply edit the deployment yaml in the GitOps repository and point to the v101 image a second time.  At runtime, the task that performs an `oc apply` of the experiment will simply state that nothing has changed on the already existing `iter8-demo-v101` experiment resource and the pipeline will take the existing experiment's result.  There are nnumerous ways the provided sample could be updated to function differently but they are beyond the scope of this basic learning exercise.

### Sequential Running Of Experiments

In an automated pipeline you would need to manage the creation of experiments either from within your pipeline (or some other way) to ensure that only one experiment was created at any time and that the experiments are created in the correct order of commits (if triggered from pushes to the main branch).

This is because Iter8 can fail or pause any additional experiments created when another experiment is running that uses the same baseline.  Single threading your experiments also gives some protection from baseline deployments of one experiment being removed by an experiment currently in flight.  

### Live Deployment Tracking

This tutorial does not fully take into account the ability to know what version of code is active versus the version of code specified in your microservice repository.

The tutorial made use of prebuilt microservice images tagged v100, v101 and v102 to simplify the code changes being made to the DevOps yaml by the end user.  We could have used the commit id of the code change in the original microservice source code repository as the image tag and on the deployment such that we could easily relate a deployment name to a commit from source.  There are myriad ways you could work around this issue but it is beyond the scope of this tutorial.

### Upcoming version 1.0.0 of Iter8

The v1.0.0 release of Iter8 changes the structure of the Experiment CRD, you will need to modify the experiment creation in the config/create-experiment-task.yaml file and any of the affected pipeline.


