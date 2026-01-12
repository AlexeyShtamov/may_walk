# Один этап - проще и быстрее для Render
FROM maven:3.8.4-openjdk-17
WORKDIR /app
# Копируем только нужные файлы для Maven
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests
EXPOSE 8080
CMD ["java", "-jar", "target/*.jar"]