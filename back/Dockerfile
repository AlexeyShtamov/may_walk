FROM maven:3.8.4-openjdk-17 AS builder
WORKDIR /app
COPY back/pom.xml .
RUN mvn dependency:go-offline -B
COPY back/src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]