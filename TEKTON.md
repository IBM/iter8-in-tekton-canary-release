# Tekton Architecture and Resources In This Tutorial

The yaml files used in this tutorial are found in the config directory and are used for:

  - `100-init.yaml` 

    Defines the initial front and backend `Services` and `Deployments` that make up our application.  Additionally it adds two istio resources, a `Gateway` and a `Virtual Service` that enables istio to route traffic to our front end `Service` from the istio ingress-gateway on the /demo context route.


  - `100-user-secrets-and-binding.yaml`

    Defines two `Secrets` used to access the git repositories.  The secret with the `tekton.dev/git-0` annotation is used to initialise gitconfig in our `Tasks` such that we can clone the git-ops repository.

    The second secret is used by the github-set-status `Task` at the end of our `Pipeline` to update the commit status.

    Additionally, within this file we set some parameters defining the git server you are using and its api path.  These are values needed in our pipeline which cannot easily be obtained from the webhok payload.


  - `150-serviceaccount.yaml`

    Defines a service account patched with one of the github `Secrets` created previously.  This service account will be used to run the pipeline.
  
  
  - `200-create-experiment-task`
  
    This `Task` is used to create the iter8 `Experiment`, it identifies the baseline deployment in a heuristic way, prefering to look at the stable `DestinationRule` but if not defined selecting the first deployment that satisfies the `Service` selector.

    The candidate deployment is obtained from examining the deployment yaml, and as such some of the first actions that occur when this task runs are the setting up of credentials and the cloning of the git-ops repository.

    The experiment success criteria are hard coded within the `Task` but could have been parameterized.

    The experiment created is of the form shown below, where ${EXPERIMENT_NAME} is set to the ${CANDIDATE_DEPLOYMENT_NAME} in the `Task`:

    ```
        apiVersion: iter8.tools/v1alpha1
        kind: Experiment 
        metadata:
          name: ${EXPERIMENT_NAME}
        spec:
          targetService:
            name: $(inputs.params.service-name)
            apiVersion: v1 
            baseline: ${BASELINE_DEPLOYMENT_NAME}
            candidate: ${CANDIDATE_DEPLOYMENT_NAME}
          trafficControl:
            strategy: check_and_increment
            interval: 30s
            trafficStepSize: 20
            maxIterations: 8 #default value = 100
            maxTrafficPercentage: 80 #default value = 50
            onSuccess: ${ON_SUCCESS}
          analysis:
            analyticsService: "http://iter8-analytics.iter8:8080"
            successCriteria:
              - metricName: iter8_latency
                toleranceType: threshold
                tolerance: 0.2
                sampleSize: 6
    ```


  - `200-generate-load-task.yaml`
  
    The git repository is cloned and the `iter8/pipeline.prop` file read to ascertain the application endpoint and the duration and frequency with which to send requets.

    The `Task` then sends requests for the configured duration unless a file has been created in the shared workspace by the experiment-completion-task indicating the `Experiment` has reached a successful conclusion.
  
  
  - `200-deploy-task.yaml`
  
    The `Task` defined here simply performs a `kubectl apply` of the `config` directory in the git-ops repository.  In the `Pipeline`, this task is coded to only run after the `Task` to create the `Experiment`.
  

  - `200-experiment-completion-task.yaml`
  
    As per the deploy `Task`, this `Task` runs after the `Experiment` has been created.  It uses the deploy.yaml to find the experiment name and then loops checking on the `Experiments` status and working out which of the experiments two `Deployments` to remove.

    A status file is created in the workspace that is shared between this `Task` and the generate-load `Task` to indicate experiment completion.
  
  
  - `300-rbac.yaml`
  
    Defines a `ClusterRole` and `RoleBinding` to include the service account created earlier whilch will be running the pipeline.  Note: The RBAC defined may well be more than is required and you should always ensure you are permitting the correct access levels in any of your own production code.

  
  - `300-simple-pipeline.yaml`

    This file defines the `Pipeline`, bringing together all the previously defined `Tasks`.  There are a number of required parameters on the `Pipeline` to satisfy the inputs to the numerous `Tasks`
  
  
  - `400-webhook-event-handling.yaml`

    The contents of this file handle all the artefacts relating to Tekton Triggers (other than the `Trigger Binding` in the `100-user-secrets-and-binding.yaml` file).

    It defines the `Route` and the `EventListener` to which the webhook submits event notifications.  The `EventListener` is very basic and contains a single `Trigger` which filters out any event that is not a `push` event to a `master` branch.

    A `TriggerBinding` extracts values from the webhook payload and sets them as parameters on the `PipelineRun` defined in the `TriggerTemplate`.  Both of these are defined in this file.

    A `PipelineRun` is essentially an instance of the `Pipeline`.

### Graphical Representation

Below we can see a graphical representation of the tekton artefacts defined and their relationship to each other.  In the `eventlistener` is a trigger definition, this trigger is made up of `triggerbindings` and a `triggertemplate`.  The `triggertemplate` defines a `pipelinerun` and therefore references a `pipeline` which in turn references `tasks`.

![Generic Tekton Resources](./images/generic-parts.png?raw=true "View Of Tekton Resources")

Here, the generic names have been replaced with the specific names used in the tutorial.  You would be able to `oc get` the object (from the diagram above) with the name from the diagram below in the `tekton-pipelines` namespace. 

![Named Tekton Resources](./images/named-pieces.png?raw=true "View Of Named Tekton Resources")

The `eventlistener`is exposed to our network via an openshift `route` - the webhook on our git repository sends events via this `route` to the `eventlistener`.  The `eventlistener` has an `interceptor` configured which checks the webhook's event is a push to `master` - if the webhook event is confirmed, the configured `triggerbindings` set parameter values by extracting the specified elements from the webhook payload.  These parameters from the `triggerbindings` are fed to the `triggertemplate` (by the eventlistener) and set onto parameter values of the `pipelinerun` it defines and creates.

Below is the flow of events:

![Pipeline Flow](./images/full-run.png?raw=true "View Of Pipeline")

Although not shown in the diagram above, the pipeline is not coded to run all the tasks sequentially and its DAG is more akin to the image shown below with application load generation and the iter8 experiment creation tasks running concurrently.  The tasks to deploy the new microservice and to monitor the experiment execute concurrently after completion of the experiment creation task and the final task to update the git commit status executes after completion of the experiment monitoring task.

![DAG of Pipeline](./images/DAG-small.png?raw=true "View Of Pipeline as DAG")

### Additional Note

The Tekton setup used here makes use of the Tekton custom resource `PipelineResource` to clone the git repository into the workspace for a number of `Tasks`.  This `PipelineResource` custom resource is now in the process of being deprecated in Tekton and `Tasks` would now need to be used to execute the same functionality.  

The pipeline could also have been further optimised by sharing the workspace amongst tasks rather than executing the clone independently each time it was needed.

Both the Iter8 and Tekton open source projects are relatively young at the time of writing and the methodology used within this tutorial may not be in line with the latest thinking or supported way of operating.  The author has tried to state the specific versions of software used at relevant points to ensure the tutorial functions correctly.