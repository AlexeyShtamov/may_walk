# Простой одноэтапный Dockerfile
FROM maven:3.8.4-openjdk-17
WORKDIR /app
# Сначала копируем pom.xml и загружаем зависимости
COPY pom.xml .
RUN mvn dependency:resolve
# Затем копируем исходники и собираем
COPY src ./src
RUN mvn clean package -DskipTests
EXPOSE 8080
CMD ["java", "-jar", "target/*.jar"]