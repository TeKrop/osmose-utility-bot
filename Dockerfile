FROM debian:bullseye

CMD ["bash", "/opt/osmose-utility-bot/app.sh"]

RUN apt update \
    && apt install -y --no-install-recommends apt-transport-https apt-utils ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
    && apt install -y --no-install-recommends nodejs build-essential git \
    && cd /opt/ \
    && git clone https://github.com/TeKrop/osmose-utility-bot.git \
    && cd osmose-utility-bot \
    && npm install \
    && npm install -g nodemon \
    && rm -rf /var/lib/{apt,dpkg,cache,log}/ /tmp/* /var/tmp/*