import java.util.Scanner;

public class odd_even {
    public static void main(String[] args) {
        int a;
        Scanner sc = new Scanner(System.in);

        System.out.print("Enter number: ");
        a = sc.nextInt();

        if(a%2 == 0) {
            System.out.println("Given number is even");
        }
        else {
            System.out.println("Given number is odd");
        }
    }
}
