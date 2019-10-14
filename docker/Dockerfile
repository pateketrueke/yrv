# development utilities
FROM mhart/alpine-node:11 as nodejs
  RUN apk update && apk add make figlet bash-completion curl git sudo postgresql-client python-dev py-pip g++ jq
  RUN npm i -g npm@latest new-port-cli node-wait-for-it wait-for-postgres
  RUN pip install awscli

FROM nodejs
  RUN mkdir /var/lib/app

  COPY package*.json /var/lib/app/
  WORKDIR /var/lib/app
  RUN npm ci

  COPY ./ /var/lib/app
  RUN npm run build

  COPY ./docker/scripts /home/docker/

  ENTRYPOINT ['true']
