# Copy the dependencies into a slim Node docker image
FROM node:12

WORKDIR /project

COPY package*.json ./

RUN npm install express request

COPY user-app/app.js .


# Copy the dependencies into a slim Node docker image
FROM node:12-slim

WORKDIR /project

# Copy project with dependencies
COPY --chown=node:node --from=0 /project ./

USER node

EXPOSE 3000
CMD ["node", "app.js"]
