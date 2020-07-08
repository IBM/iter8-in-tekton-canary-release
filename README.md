# Performing Automated Canary Releases Using Iter8 In Tekton

In this article we look at using Iter8 in a Tekton pipeline to perform automated canary releases of a microservice.  With canary releases, a new version of your microservice is deployed to sit alongside your existing version and traffic is routed to your new version as specified in a set of rules.  You then monitor how your new version performs and make decisions about increasing the traffic to your new deployment until such a time that all traffic is directed to the new release. 

Iter8 v0.1.1 automates cloud-native canary releases, driven by analytics based on robust statistical techniques. It comprises two components, the iter8-analytics component and the iter8-controller component. 

The analytics component assesses the behavior of different versions of a microservice by analyzing metrics to determine if the newer version performs to the specified success criteria. 

The Iter8 controller adjusts traffic between the different versions of the microservice based on recommendations from the analytics components' REST API.  Fundamentally, traffic decisions are made by the analytics component and honored by the controller. 

The test and its success criteria are defined in an experiment - a kubernetes custom resource defined by Iter8.  In the experiment we define properties such as, the baseline and candidate deployments, the metric to be analysed (e.g iter8_latency: the latency of the service), the number of iterations of the experiment to run and what routing rules to apply, for example - increase traffic to the new service by 20% after each successful iteration.  The metrics that are analysed come from interrogations of prometheus by the analytics component.


## Example of using Iter8 in Tekton

In the tutorial associated with this article we have a simple web application made up of a frontend service which performs a call to a backend service and displays the result to the user.

![Initial Application Flow](./images/application.png?raw=true "View Of The Two Services Communicating")

By making a change to the deployment yaml stored in a git repository, a webhook triggers a Tekton pipeline that will create and run the Iter8 experiment.  The pipeline generates web traffic to the application, faking user requests (as this is not a live application with actual users) for Iter8 to analyse.  Iter8 then makes use of istio to control the split of traffic between the older and newer deployments depending upon the analyitcal information from prometheus.

![Iter8 Experiment Flow](./images/experiment-architecture.png?raw=true "View Showing Iter8 Components with Application")

The pipeline used in the tutorial runs through 5 tasks, creating the Iter8 experiment, generating load to the application, applying the new deployment causing the experiment to start, wait for experiment completion and finally update the git commit status based on the result.

![Pipeline Overview](./images/pipeline.png?raw=true "Overview of Steps in The Pipeline")

Whilst the pipeline is made up of 5 tasks, they do not all run sequentially and the topology is actually more akin to the diagram below.  You can read more about the Tekton resources used in the tutorial [here](./TEKTON.md)

![Task Topology](./images/DAG.png?raw=true "Topological diagram showing parallel tasks.")


The result of the experiment will dictate which deployment of the microservice is left running - the pipeline task that checks for the experiment's completion removing the unused microservice deployment.  

More on the Experiment CRD can be found in the Iter8 [docs](https://github.com/iter8-tools/docs), but ensure you look at the relevant version of the documentation for your Iter8 installation.

The Experiment as defined in the tutorial's pipeline Task:

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

In the tutorial code changes are made twice, once testing a deployment of the microservice that does not not meet the success criteria and then again with a version that does.  The video below shows the two runs in action (note: return to this page using your browser's back button after viewing):

[![Watch the video](./images/iter8-in-tekton-video.png)](http://www.youtube.com/watch?v=LLfUapMbNWw "Performing automated canary releases using Iter8 in Tekton tutorial")


## Broader usage of Iter8 in DevOps/GitOps

The tutorial gives you a flavour for how you can add Iter8 into Tekton pipelines.  With an understanding of this simple scenario you should be able to extrapolate how you can use Iter8 in broader DevOps/GitOps scenarios.

The point at which you might want to use technology like Iter8 is highly debated and beyond the scope of this article - some argue that you would not use such release strategies in production whilst others advocate it; some would not use it in development environments whilst others would.  Only you can decide what is the best fit for your organisation and it will depend on what you are trying to achieve.

As more support for different release strategies are added, it may be that you want to use Iter8 in a number of places to achieve different goals.  You might use Iter8 for performance testing throughout the development, staging and production phases of the software delivery lifecycle, but only performing A/B testing for user feature prefence in your production environment.

An extreme version of the performance testing use case might see usage in a scenario similar to that pictured below:

![Larger Conceptual Use of Iter8 In GitOps](./images/concept.png?raw=true "Overview of a Larger GitOps Solution Involving Iter8")

Here, Iter8 is integrated into three pipelines across two repositories.  When developers submit pull requests (PR) to the microservice, Iter8 is used as one of the verification tests - this would likely be in an isolated namespace so the base deployment of the main branch would need installing as well as the newly built service.  The results of the experiment here could be fed back and marked onto the pull request giving the developer the earliest possible opportunity to realise they have introduced a performance problem.  However, note that this may not be feasible as your microservice may not be able to be tested in isolation from the broader application, and it may not be feasible to install the entire application into the test namespace, equally if possible it might mean the testing you do at this stage is specific to this microservice, whilst later in the lifecycle you canary test the application performance as a whole.

After an approver merges the pull request into the main branch another pipeline is triggered which runs an Iter8 experiment on the code as it now appears in the main branch - we could even use tools within our pipeline to create pull requests into our GitOps repo upgrading the image tag for the specific service upon successful completion of all tests.

The GitOps repo itself could trigger a third pipeline which looks to test the new build in the live environment.  If successful Iter8 can leave the new deployment in place and remove the old one, again tools could be used to automerge the pull request into the main branch from within the pipeline and also close out the pull request.  Notifications can even be sent to Slack channel or emailed to advise of problems/successes.

In v0.2 of Iter8 you can now compare between a baseline and candidate service rather than deployments and from v1.0.0 of Iter8 you are able to perform A/B deployments, but these are beyond the scope of this article.


## Summary

Iter8 and Tekton can be combined together to give powerful cloud native release automation based on runtime performance analytics - and this looks likely to become more powerful with newer releases.

Getting up and running with Iter8 is relatively simple and the tutorials provided in the Iter8 GitHub repository provide a good grounding in how to use the technology.  There is plenty of active development both on the codebase and the associated documentation with additional media such as blogs and videos coming soon.

Tekton itself is proving to be ever more powerful and popular, with the associated kubernetes custom resources recently having moved from an alpha to beta API group, guaranteeing more stability between releases.  

A growing community supplies the Tekton catalog repository with “off the shelf” tasks that can be integrated into your own pipelines.  The tutorial associated with this article makes use of one of these community tasks to perform the GitHub status updates.  The continued growth of the catalog repository and other supporting software might be key in Tekton's success - ensuring users can easily switch from other technologies where a set of available plugins and extensions are already available and in use.

To run through the tutorial to see Iter8 in action as part of a Tekton pipeline click [here](./INSTRUCTIONS.md).
