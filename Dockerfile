FROM node:25-alpine

WORKDIR /code

COPY index.js deploy-commands.js package.json package-lock.json app.sh /code/
COPY ./commands /code/commands
COPY ./constants /code/constants
COPY ./services /code/services

RUN cd /code && npm install --omit=dev

CMD ["sh", "/code/app.sh"]
