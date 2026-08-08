FROM gcc:latest

WORKDIR /code

COPY executor.sh /executor.sh
RUN chmod +x /executor.sh

ENTRYPOINT ["/executor.sh"]