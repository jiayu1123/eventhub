package com.eventhub;

import org.springframework.boot.SpringApplication;

public class TestEventhubJavaApplication {

	public static void main(String[] args) {
		SpringApplication.from(EventhubJavaApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
